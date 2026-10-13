-- Account deletion with profile tombstones
-- (policy: docs/features/account-document-deletion-retention-rules.md, approved 2026-10-12;
--  tombstone design confirmed by the owner 2026-10-13).
--
-- Deleting an Auth user used to cascade through `profiles` into the other
-- participant's matches and messages and into every safety report. Now the
-- profile row is scrubbed into a tombstone ("Izbrisan uporabnik") instead, so
-- those rows keep a valid reference while no identifying data remains. The
-- scrub runs in a `before delete` trigger on auth.users, so it happens however
-- the account is deleted: self-service, the Supabase dashboard or the admin API.
-- Files in the `vpisnice` bucket cannot be removed from SQL; the deletion
-- function and the operator procedure delete them before the Auth user.

-- 1. Detach profiles from Auth deletion (the trigger below replaces the cascade).
do $$
declare
    fk record;
begin
    for fk in
        select con.conname
        from pg_constraint con
        where con.conrelid = 'public.profiles'::regclass
          and con.contype = 'f'
          and con.confrelid = 'auth.users'::regclass
    loop
        execute format('alter table public.profiles drop constraint %I', fk.conname);
    end loop;
end $$;

alter table public.profiles add column if not exists deleted_at timestamptz;

-- Only the deletion trigger sets deleted_at; API callers can't set or clear it.
create or replace function public.protect_profile_tombstone()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if coalesce(auth.role(), '') in ('authenticated', 'anon') then
        if tg_op = 'INSERT' then
            new.deleted_at := null;
        else
            new.deleted_at := old.deleted_at;
        end if;
    end if;
    return new;
end;
$$;
revoke all on function public.protect_profile_tombstone() from public;

drop trigger if exists protect_profile_tombstone on public.profiles;
create trigger protect_profile_tombstone
    before insert or update on public.profiles
    for each row execute function public.protect_profile_tombstone();

-- 2. Safety identity record (owner decision 2026-10-12): the e-mail and name of a
--    deleted user, kept so a harassment case can still be followed up. Only the
--    database owner can read it: RLS on, no policies, no grants to API roles,
--    and no RPC or admin view joins it.
create table if not exists public.deleted_user_safety_records (
    profile_id uuid primary key references public.profiles (id) on delete cascade,
    email text,
    display_name text not null default '',
    deleted_at timestamptz not null default now()
);
alter table public.deleted_user_safety_records enable row level security;
revoke all on public.deleted_user_safety_records from anon, authenticated;

-- 3. Report retention fields: the conversation a report came from, and when it
--    was closed (retention runs 12 months from closing).
alter table public.reports
    add column if not exists match_id uuid references public.matches (id) on delete set null,
    add column if not exists closed_at timestamptz;

update public.reports
set closed_at = created_at
where status <> 'open' and closed_at is null;

create or replace function public.track_report_closing()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    if new.status = 'open' then
        new.closed_at := null;
    elsif tg_op = 'INSERT' or old.status = 'open' or old.closed_at is null then
        new.closed_at := coalesce(new.closed_at, now());
    else
        new.closed_at := old.closed_at;
    end if;
    return new;
end;
$$;
revoke all on function public.track_report_closing() from public;

drop trigger if exists track_report_closing on public.reports;
create trigger track_report_closing
    before insert or update on public.reports
    for each row execute function public.track_report_closing();

-- 4. The scrub itself.
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

drop trigger if exists on_auth_user_deleted on auth.users;
create trigger on_auth_user_deleted
    before delete on auth.users
    for each row execute function public.handle_deleted_user();

-- 5. Keep tombstones out of new activity. Nobody can sign in as a deleted user,
--    so these stop the *other* person from writing to them.
create or replace function public.is_deleted_profile(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.profiles where id = p_id and deleted_at is not null
    );
$$;
revoke all on function public.is_deleted_profile(uuid) from public;
grant execute on function public.is_deleted_profile(uuid) to authenticated;

drop policy if exists matches_insert on public.matches;
create policy matches_insert on public.matches for insert to authenticated with check (
    auth.uid() = user_id_a
    and not public.is_blocked_between(user_id_a, user_id_b)
    and not public.is_deleted_profile(user_id_b)
);

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert to authenticated with check (
    auth.uid() = sender_id and exists (
        select 1 from public.matches m
        where m.id = match_id
          and m.status = 'accepted'
          and (auth.uid() = m.user_id_a or auth.uid() = m.user_id_b)
          and not public.is_blocked_between(m.user_id_a, m.user_id_b)
          and not public.is_deleted_profile(m.user_id_a)
          and not public.is_deleted_profile(m.user_id_b)
    )
);
