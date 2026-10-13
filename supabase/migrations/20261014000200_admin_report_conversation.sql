-- Admin access to reported conversations (deletion plan step 3; policy option 1).
-- In-app admins may read only a conversation linked to a report, and every read
-- is recorded. Admins never get a select policy on `messages`; the function
-- below is the only way in. The database owner keeps full access in Supabase.

create table if not exists public.admin_message_reads (
    id uuid primary key default gen_random_uuid(),
    admin_id uuid not null,
    report_id uuid not null,
    read_at timestamptz not null default now()
);
create index if not exists admin_message_reads_read_at_idx
    on public.admin_message_reads (read_at);

-- Append-only: admins can review the log, nobody can change it through the API.
alter table public.admin_message_reads enable row level security;
revoke all on public.admin_message_reads from anon, authenticated;
grant select on public.admin_message_reads to authenticated;
drop policy if exists admin_message_reads_select on public.admin_message_reads;
create policy admin_message_reads_select on public.admin_message_reads
    for select to authenticated using (public.is_admin());

create or replace function public.admin_report_conversation(p_report_id uuid)
returns table (
    message_id uuid,
    sender_role text,
    body text,
    sent_at timestamptz,
    source text
)
language plpgsql
security definer
set search_path = public
as $$
declare
    r public.reports;
begin
    if not public.is_admin() then
        raise exception 'admin only' using errcode = '42501';
    end if;
    select * into r from public.reports where id = p_report_id;
    if not found then
        raise exception 'report not found' using errcode = 'P0002';
    end if;

    insert into public.admin_message_reads (admin_id, report_id)
    values (auth.uid(), p_report_id);

    if exists (select 1 from public.report_evidence e where e.report_id = p_report_id) then
        return query
            select e.message_id, e.sender_role, e.body, e.sent_at, 'snapshot'::text
            from public.report_evidence e
            where e.report_id = p_report_id
            order by e.sent_at;
    elsif r.match_id is not null then
        -- Reports filed before evidence existed: the live conversation, by role.
        return query
            select m.id,
                   case when m.sender_id = r.reporter_id then 'reporter' else 'reported' end,
                   m.body,
                   m.sent_at,
                   'live'::text
            from public.messages m
            where m.match_id = r.match_id
            order by m.sent_at;
    end if;
end;
$$;
revoke all on function public.admin_report_conversation(uuid) from public;
grant execute on function public.admin_report_conversation(uuid) to authenticated;
