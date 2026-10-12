-- Admin authorization boundary (web feature "Admin authorization boundary").
-- RLS and grants are the security boundary for admin capabilities; the web
-- `/admin` UI guard only decides what to render. This migration:
--   1. adds one `is_admin()` helper used by every admin policy;
--   2. makes `admins` read-only for API roles (membership is managed with the
--      service role or SQL only);
--   3. limits admin report updates to the `status` column;
--   4. stops non-admins from setting `profiles.academic_status_verified`.

-- 1. Helper ---------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- 2. Admin membership is not writable through the API -------------------

-- No insert/update/delete policies exist; revoking the privileges as well
-- means a policy added by mistake later still cannot grant admin rights.
revoke insert, update, delete, truncate on public.admins from anon, authenticated;

drop policy if exists admins_self_select on public.admins;
create policy admins_self_select on public.admins for select to authenticated
    using (auth.uid() = user_id);

-- 3. Reports: admins read all and may change only the status ---------------

drop policy if exists reports_admin_select on public.reports;
create policy reports_admin_select on public.reports for select to authenticated
    using (public.is_admin());

drop policy if exists reports_admin_update on public.reports;
create policy reports_admin_update on public.reports for update to authenticated
    using (public.is_admin())
    with check (public.is_admin());

-- Column privileges: an admin cannot rewrite who reported whom or why.
revoke update on public.reports from anon, authenticated;
grant update (status) on public.reports to authenticated;

-- Reports are never deleted through the API (no delete policy); make it explicit.
revoke delete, truncate on public.reports from anon, authenticated;

-- 4. Academic verification is an admin decision ---------------------------

-- `profiles_update` lets users update their own row, including
-- `academic_status_verified`. For signed-in non-admins the flag is kept as it
-- was (and forced to false on insert) instead of raising, so clients that send
-- the whole row, like Android's profile save, keep working. The service role,
-- SQL, and the signup trigger are unaffected.
create or replace function public.protect_academic_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if coalesce(auth.role(), '') = 'authenticated' and not public.is_admin() then
        if tg_op = 'INSERT' then
            new.academic_status_verified := false;
        else
            new.academic_status_verified := old.academic_status_verified;
        end if;
    end if;
    return new;
end;
$$;
revoke all on function public.protect_academic_verification() from public;

drop trigger if exists protect_academic_verification on public.profiles;
create trigger protect_academic_verification
    before insert or update on public.profiles
    for each row execute function public.protect_academic_verification();
