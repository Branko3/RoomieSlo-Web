-- Cohabitation declarations ("Živiva skupaj"), part A of
-- docs/nontechnical/cohabitation-and-ratings.md (approved by the owner 2026-10-16).
--
-- A participant of an accepted match declares that the two live together from a
-- given month; the other participant confirms or declines. Either one can end an
-- active cohabitation alone. Only the two participants can read a cohabitation:
-- it is never shown on profiles, in recommendations or search, and in-app admins
-- have no access (only the database owner, through Supabase).
--
-- RLS allows participants to read their rows and nothing else. Every write goes
-- through the security-definer RPCs below, which repeat each check explicitly
-- because RLS does not apply inside them. Months are first-of-month dates in
-- Europe/Ljubljana time.

create table if not exists public.cohabitations (
    id uuid primary key default gen_random_uuid(),
    match_id uuid not null references public.matches (id) on delete cascade,
    -- Copied from the match; cascades like matches do (only the retention job
    -- removes profiles, and only once no match refers to them).
    user_id_a uuid not null references public.profiles (id) on delete cascade,
    user_id_b uuid not null references public.profiles (id) on delete cascade,
    initiated_by uuid not null references public.profiles (id) on delete cascade,
    status text not null default 'pending'
        check (status in ('pending', 'active', 'declined', 'ended')),
    started_month date not null,
    ended_month date,
    declined_at timestamptz,
    confirmed_at timestamptz,
    ended_at timestamptz,
    version integer not null default 1,
    created_at timestamptz not null default now(),
    constraint cohabitations_distinct_users check (user_id_a <> user_id_b),
    constraint cohabitations_initiator_is_participant
        check (initiated_by in (user_id_a, user_id_b)),
    constraint cohabitations_started_month_first_day
        check (extract(day from started_month) = 1),
    constraint cohabitations_ended_month_first_day
        check (ended_month is null or extract(day from ended_month) = 1),
    constraint cohabitations_ended_after_start
        check (ended_month is null or ended_month >= started_month),
    constraint cohabitations_ended_month_only_when_ended
        check ((status = 'ended') = (ended_month is not null))
);

-- At most one open (pending or active) declaration per match.
create unique index if not exists cohabitations_one_open_per_match
    on public.cohabitations (match_id)
    where status in ('pending', 'active');
create index if not exists cohabitations_user_a_idx on public.cohabitations (user_id_a);
create index if not exists cohabitations_user_b_idx on public.cohabitations (user_id_b);

alter table public.cohabitations enable row level security;

-- Participants read their own cohabitations; there are no insert, update or
-- delete policies, and API roles have no table write privileges either.
revoke all on public.cohabitations from anon, authenticated;
grant select on public.cohabitations to authenticated;

drop policy if exists cohabitations_select_participants on public.cohabitations;
create policy cohabitations_select_participants on public.cohabitations for select to authenticated
    using (auth.uid() = user_id_a or auth.uid() = user_id_b);

-- The current month (first day) in Slovenian time; used by the RPCs and the
-- deletion trigger so every month rule uses the same clock.
create or replace function public.cohabitation_current_month()
returns date
language sql
stable
set search_path = public
as $$
    select date_trunc('month', now() at time zone 'Europe/Ljubljana')::date;
$$;
revoke all on function public.cohabitation_current_month() from public, anon, authenticated;

-- "Živiva skupaj": declares a cohabitation from p_started_month.
create or replace function public.declare_cohabitation(p_match_id uuid, p_started_month date)
returns public.cohabitations
language plpgsql
security definer
set search_path = public
as $$
declare
    me uuid := auth.uid();
    m public.matches;
    declared public.cohabitations;
begin
    if me is null then
        raise exception 'not signed in' using errcode = '42501';
    end if;

    -- Lock the match so two declarations for it are decided one after the other.
    select * into m from public.matches where id = p_match_id for update;
    if not found or me not in (m.user_id_a, m.user_id_b) then
        raise exception 'match is unavailable or caller is not a participant'
            using errcode = '42501';
    end if;
    if m.status <> 'accepted' then
        raise exception 'match is not accepted' using errcode = '42501';
    end if;
    if public.is_deleted_profile(m.user_id_a) or public.is_deleted_profile(m.user_id_b) then
        raise exception 'a participant has deleted their account' using errcode = '42501';
    end if;
    if public.is_blocked_between(m.user_id_a, m.user_id_b) then
        raise exception 'a block exists between the participants' using errcode = '42501';
    end if;

    -- Month rules: a first day, not in the future, not before the match's month.
    if p_started_month is null or extract(day from p_started_month) <> 1 then
        raise exception 'cohabitation month must be the first day of a month'
            using errcode = '22023';
    end if;
    if p_started_month > public.cohabitation_current_month() then
        raise exception 'cohabitation month is in the future' using errcode = '22023';
    end if;
    if p_started_month < date_trunc('month', m.created_at at time zone 'Europe/Ljubljana')::date then
        raise exception 'cohabitation month is before the match was created'
            using errcode = '22023';
    end if;

    if exists (
        select 1 from public.cohabitations c
        where c.match_id = m.id and c.status in ('pending', 'active')
    ) then
        raise exception 'an open cohabitation already exists for this match'
            using errcode = '23505';
    end if;

    -- 30-day cooldown for the same declarer after a decline, so the other
    -- person is not pestered.
    if exists (
        select 1 from public.cohabitations c
        where c.match_id = m.id
          and c.initiated_by = me
          and c.status = 'declined'
          and c.declined_at > now() - interval '30 days'
    ) then
        raise exception 'cohabitation cooldown: a declaration was declined less than 30 days ago'
            using errcode = 'P0001';
    end if;

    insert into public.cohabitations (match_id, user_id_a, user_id_b, initiated_by, status, started_month)
    values (m.id, m.user_id_a, m.user_id_b, me, 'pending', p_started_month)
    returning * into declared;
    return declared;
end;
$$;
revoke all on function public.declare_cohabitation(uuid, date) from public, anon;
grant execute on function public.declare_cohabitation(uuid, date) to authenticated;

-- "Potrdi" (p_confirm = true) or "Ne drži" (false), by the other participant only.
create or replace function public.respond_cohabitation(p_id uuid, p_confirm boolean)
returns public.cohabitations
language plpgsql
security definer
set search_path = public
as $$
declare
    me uuid := auth.uid();
    c public.cohabitations;
    m public.matches;
    answered public.cohabitations;
begin
    if me is null then
        raise exception 'not signed in' using errcode = '42501';
    end if;
    if p_confirm is null then
        raise exception 'an answer is required' using errcode = '22023';
    end if;

    select * into c from public.cohabitations where id = p_id for update;
    if not found or me not in (c.user_id_a, c.user_id_b) then
        raise exception 'cohabitation is unavailable or caller is not a participant'
            using errcode = '42501';
    end if;
    if me = c.initiated_by then
        raise exception 'only the other participant can respond' using errcode = '42501';
    end if;

    select * into m from public.matches where id = c.match_id;
    if not found or m.status <> 'accepted' then
        raise exception 'match is not accepted' using errcode = '42501';
    end if;
    if public.is_deleted_profile(c.user_id_a) or public.is_deleted_profile(c.user_id_b) then
        raise exception 'a participant has deleted their account' using errcode = '42501';
    end if;
    if p_confirm and public.is_blocked_between(c.user_id_a, c.user_id_b) then
        raise exception 'a block exists between the participants' using errcode = '42501';
    end if;

    if c.status <> 'pending' then
        raise exception 'cohabitation is no longer pending' using errcode = 'P0001';
    end if;
    if p_confirm and c.started_month > public.cohabitation_current_month() then
        raise exception 'cohabitation month is in the future' using errcode = '22023';
    end if;

    if p_confirm then
        update public.cohabitations
        set status = 'active', confirmed_at = now(), version = version + 1
        where id = c.id
        returning * into answered;
    else
        update public.cohabitations
        set status = 'declined', declined_at = now(), version = version + 1
        where id = c.id
        returning * into answered;
    end if;
    return answered;
end;
$$;
revoke all on function public.respond_cohabitation(uuid, boolean) from public, anon;
grant execute on function public.respond_cohabitation(uuid, boolean) to authenticated;

-- "Ne živiva več skupaj": either participant ends an active cohabitation alone.
-- A block does not prevent this (the two may still live together, or not).
create or replace function public.end_cohabitation(p_id uuid, p_ended_month date)
returns public.cohabitations
language plpgsql
security definer
set search_path = public
as $$
declare
    me uuid := auth.uid();
    c public.cohabitations;
    m public.matches;
    ended public.cohabitations;
begin
    if me is null then
        raise exception 'not signed in' using errcode = '42501';
    end if;

    select * into c from public.cohabitations where id = p_id for update;
    if not found or me not in (c.user_id_a, c.user_id_b) then
        raise exception 'cohabitation is unavailable or caller is not a participant'
            using errcode = '42501';
    end if;

    select * into m from public.matches where id = c.match_id;
    if not found or m.status <> 'accepted' then
        raise exception 'match is not accepted' using errcode = '42501';
    end if;
    if public.is_deleted_profile(c.user_id_a) or public.is_deleted_profile(c.user_id_b) then
        raise exception 'a participant has deleted their account' using errcode = '42501';
    end if;

    if c.status <> 'active' then
        raise exception 'cohabitation is not active' using errcode = 'P0001';
    end if;

    -- Month rules: a first day, not before the move-in month, not in the future.
    if p_ended_month is null or extract(day from p_ended_month) <> 1 then
        raise exception 'cohabitation month must be the first day of a month'
            using errcode = '22023';
    end if;
    if p_ended_month < c.started_month then
        raise exception 'cohabitation month is before the move-in month'
            using errcode = '22023';
    end if;
    if p_ended_month > public.cohabitation_current_month() then
        raise exception 'cohabitation month is in the future' using errcode = '22023';
    end if;

    update public.cohabitations
    set status = 'ended', ended_month = p_ended_month, ended_at = now(), version = version + 1
    where id = c.id
    returning * into ended;
    return ended;
end;
$$;
revoke all on function public.end_cohabitation(uuid, date) from public, anon;
grant execute on function public.end_cohabitation(uuid, date) to authenticated;

-- Block hook: a new block (either direction) declines pending declarations
-- between the pair. Active cohabitations stay and can still be ended.
create or replace function public.decline_cohabitations_on_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.cohabitations
    set status = 'declined', declined_at = now(), version = version + 1
    where status = 'pending'
      and ((user_id_a = new.blocker_id and user_id_b = new.blocked_id)
        or (user_id_a = new.blocked_id and user_id_b = new.blocker_id));
    return new;
end;
$$;
revoke all on function public.decline_cohabitations_on_block() from public, anon, authenticated;

drop trigger if exists decline_cohabitations_on_block on public.blocks;
create trigger decline_cohabitations_on_block
    after insert on public.blocks
    for each row execute function public.decline_cohabitations_on_block();

-- Account deletion: the full body of handle_deleted_user from
-- 20261014000000_account_deletion_tombstones.sql, plus the cohabitation step.
create or replace function public.handle_deleted_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    -- Safety record first, while the name still exists.
    insert into public.deleted_user_safety_records (profile_id, email, display_name)
    select old.id, old.email, p.display_name
    from public.profiles p
    where p.id = old.id
    on conflict (profile_id) do nothing;

    -- Deleted outright (retention matrix: answers, favorites, own listings).
    delete from public.questionnaire_answers where profile_id = old.id;
    delete from public.favorites where profile_id = old.id;
    delete from public.listings where owner_id = old.id;
    delete from public.blocks where blocker_id = old.id or blocked_id = old.id;
    delete from public.admins where user_id = old.id;

    -- Requests nobody can answer any more.
    update public.matches
    set status = 'rejected'
    where status = 'pending' and (user_id_a = old.id or user_id_b = old.id);

    -- Cohabitations (approved 2026-10-16): a pending declaration can no longer
    -- be answered, and an active one ends this month. The rows stay so the
    -- other person's history remains correct.
    update public.cohabitations
    set status = 'declined', declined_at = now(), version = version + 1
    where status = 'pending' and (user_id_a = old.id or user_id_b = old.id);
    update public.cohabitations
    set status = 'ended',
        ended_month = public.cohabitation_current_month(),
        ended_at = now(),
        version = version + 1
    where status = 'active' and (user_id_a = old.id or user_id_b = old.id);

    -- Tombstone: matches, messages and reports keep a valid reference.
    update public.profiles
    set display_name = 'Izbrisan uporabnik',
        age = null,
        faculty = '',
        bio = '',
        avatar_url = '',
        is_available = false,
        academic_status_verified = false,
        deleted_at = now()
    where id = old.id;

    return old;
end;
$$;
revoke all on function public.handle_deleted_user() from public;

-- Retention: the full body of purge_expired_data from
-- 20261014000400_retention_jobs.sql, plus cohabitations whose participants have
-- both deleted their accounts. The pg_cron schedule from that migration stays.
create or replace function public.purge_expired_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    reports_purged integer;
    cohabitations_purged integer;
    conversations_purged integer;
    safety_records_purged integer;
    tombstones_purged integer;
    audit_rows_purged integer;
    register_subjects_cleared integer;
    register_rows_purged integer;
begin
    -- Reports (and their evidence, by cascade) 12 months after closing.
    delete from public.reports
    where closed_at is not null and closed_at < now() - interval '12 months';
    get diagnostics reports_purged = row_count;

    -- Cohabitations once both participants have deleted their accounts
    -- (approved 2026-10-16). Runs before the conversation rule, which keeps a
    -- match (and so its cohabitations) while a report still points at it.
    delete from public.cohabitations c
    using public.profiles a, public.profiles b
    where a.id = c.user_id_a and b.id = c.user_id_b
      and a.deleted_at is not null and b.deleted_at is not null;
    get diagnostics cohabitations_purged = row_count;

    -- Conversations whose participants have all deleted their accounts
    -- (messages cascade), unless a remaining report still points at them.
    delete from public.matches m
    using public.profiles a, public.profiles b
    where a.id = m.user_id_a and b.id = m.user_id_b
      and a.deleted_at is not null and b.deleted_at is not null
      and not exists (select 1 from public.reports r where r.match_id = m.id);
    get diagnostics conversations_purged = row_count;

    -- Safety identity records: 30 days after deletion, unless a report about
    -- the person is open or closed less than 12 months ago.
    delete from public.deleted_user_safety_records s
    where s.deleted_at < now() - interval '30 days'
      and not exists (
          select 1 from public.reports r
          where r.reported_id = s.profile_id
            and (r.status = 'open' or r.closed_at > now() - interval '12 months')
      );
    get diagnostics safety_records_purged = row_count;

    -- Tombstones nothing refers to any more.
    delete from public.profiles p
    where p.deleted_at is not null
      and not exists (select 1 from public.matches m where p.id in (m.user_id_a, m.user_id_b))
      and not exists (select 1 from public.messages x where x.sender_id = p.id)
      and not exists (select 1 from public.reports r where p.id in (r.reporter_id, r.reported_id))
      and not exists (select 1 from public.deleted_user_safety_records s where s.profile_id = p.id)
      and not exists (select 1 from public.cohabitations c where p.id in (c.user_id_a, c.user_id_b));
    get diagnostics tombstones_purged = row_count;

    -- Admin message-read audit log: 12 months.
    delete from public.admin_message_reads where read_at < now() - interval '12 months';
    get diagnostics audit_rows_purged = row_count;

    -- Deletion register: the subject only for the 30-day backup window,
    -- the row for the 90-day log period.
    update public.deletion_register
    set subject = null
    where subject is not null and requested_at < now() - interval '30 days';
    get diagnostics register_subjects_cleared = row_count;
    delete from public.deletion_register where requested_at < now() - interval '90 days';
    get diagnostics register_rows_purged = row_count;

    return jsonb_build_object(
        'reports', reports_purged,
        'cohabitations', cohabitations_purged,
        'conversations', conversations_purged,
        'safety_records', safety_records_purged,
        'tombstones', tombstones_purged,
        'admin_message_reads', audit_rows_purged,
        'register_subjects_cleared', register_subjects_cleared,
        'register_rows', register_rows_purged
    );
end;
$$;
revoke all on function public.purge_expired_data() from public, anon, authenticated;
