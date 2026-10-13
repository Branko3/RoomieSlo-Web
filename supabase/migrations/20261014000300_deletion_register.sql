-- Deletion register (deletion plan section 5, written by the `delete-account`
-- Edge Function). One row per completed or failed self-service deletion.
-- `subject` (the deleted user id) exists only to re-apply deletions after a
-- backup restore; the retention job clears it after 30 days and deletes the row
-- after 90 (the approved "Logs/analytics" period).

create table if not exists public.deletion_register (
    id uuid primary key default gen_random_uuid(),
    subject uuid,
    outcome text not null check (outcome in ('deleted', 'partial_failure')),
    requested_at timestamptz not null default now(),
    completed_at timestamptz
);
create index if not exists deletion_register_requested_at_idx
    on public.deletion_register (requested_at);

-- Only the function (service role) and the database owner touch it.
alter table public.deletion_register enable row level security;
revoke all on public.deletion_register from anon, authenticated;
