-- Report evidence (deletion plan step 2).
-- A report filed from a chat keeps a snapshot of that conversation, so the
-- evidence survives later account deletions and the retention job (reports and
-- their evidence are kept 12 months after closing). The snapshot stores
-- "reporter"/"reported" roles instead of user ids, so it is anonymized by design.
-- Reports are filed only through `submit_report`, which also stops users from
-- choosing a report's status or conversation themselves.

create table if not exists public.report_evidence (
    report_id uuid not null references public.reports (id) on delete cascade,
    message_id uuid not null,
    sender_role text not null check (sender_role in ('reporter', 'reported')),
    body text not null,
    sent_at timestamptz not null,
    primary key (report_id, message_id)
);
create index if not exists report_evidence_report_sent_idx
    on public.report_evidence (report_id, sent_at);

-- No policies: users and in-app admins never read this table directly; admins
-- go through the audited function added in the next migration.
alter table public.report_evidence enable row level security;
revoke all on public.report_evidence from anon, authenticated;

create or replace function public.submit_report(
    p_reported uuid,
    p_reason text,
    p_description text default '',
    p_match uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    me uuid := auth.uid();
    new_id uuid;
begin
    if me is null then
        raise exception 'not signed in' using errcode = '42501';
    end if;
    if p_reported is null or p_reported = me then
        raise exception 'invalid reported user' using errcode = '22023';
    end if;
    if coalesce(btrim(p_reason), '') = '' or length(p_reason) > 100 then
        raise exception 'invalid reason' using errcode = '22023';
    end if;
    if length(coalesce(p_description, '')) > 2000 then
        raise exception 'description too long' using errcode = '22023';
    end if;
    -- A chat report must name a conversation between exactly these two people.
    if p_match is not null and not exists (
        select 1 from public.matches m
        where m.id = p_match
          and ((m.user_id_a = me and m.user_id_b = p_reported)
            or (m.user_id_b = me and m.user_id_a = p_reported))
    ) then
        raise exception 'invalid conversation' using errcode = '22023';
    end if;

    insert into public.reports (reporter_id, reported_id, reason, description, match_id)
    values (me, p_reported, btrim(p_reason), coalesce(btrim(p_description), ''), p_match)
    returning id into new_id;

    if p_match is not null then
        insert into public.report_evidence (report_id, message_id, sender_role, body, sent_at)
        select new_id,
               recent.id,
               case when recent.sender_id = me then 'reporter' else 'reported' end,
               recent.body,
               recent.sent_at
        from (
            select id, sender_id, body, sent_at
            from public.messages
            where match_id = p_match
            order by sent_at desc
            limit 200
        ) recent;
    end if;

    return new_id;
end;
$$;
revoke all on function public.submit_report(uuid, text, text, uuid) from public;
grant execute on function public.submit_report(uuid, text, text, uuid) to authenticated;

-- Reports are filed only through submit_report.
revoke insert on public.reports from anon, authenticated;
drop policy if exists reports_insert on public.reports;
