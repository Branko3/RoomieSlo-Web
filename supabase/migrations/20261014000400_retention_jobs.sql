-- Retention jobs (deletion plan step 5). One function applies every time limit
-- of the approved retention matrix; pg_cron runs it daily. Each rule is a plain
-- delete or update, so a missed run is simply caught up by the next one.

create or replace function public.purge_expired_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    reports_purged integer;
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
      and not exists (select 1 from public.deleted_user_safety_records s where s.profile_id = p.id);
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

-- Daily at 03:15 UTC. Skipped where pg_cron is unavailable (e.g. a plain local
-- Postgres); there, run `select public.purge_expired_data();` by hand.
do $$
begin
    if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
        create extension if not exists pg_cron;
        if exists (select 1 from cron.job where jobname = 'purge-expired-data') then
            perform cron.unschedule('purge-expired-data');
        end if;
        perform cron.schedule(
            'purge-expired-data',
            '15 3 * * *',
            'select public.purge_expired_data()'
        );
    end if;
end $$;
