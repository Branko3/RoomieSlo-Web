-- User blocking for chat (web feature "Report/block chat controls").
-- A user can block another user. While a block exists in either direction,
-- neither can send messages to the other or create a new match request.
-- RLS stays the authorization boundary; the web UI only reflects it.

create table if not exists public.blocks (
    blocker_id uuid not null references public.profiles (id) on delete cascade,
    blocked_id uuid not null references public.profiles (id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (blocker_id, blocked_id),
    constraint blocks_distinct_users check (blocker_id <> blocked_id)
);

create index if not exists blocks_blocked_idx on public.blocks (blocked_id);

alter table public.blocks enable row level security;

-- Users see and manage only the blocks they created; whether someone blocked
-- you is not revealed (only its effect: messages and requests are refused).
drop policy if exists blocks_select_own on public.blocks;
create policy blocks_select_own on public.blocks for select to authenticated
    using (auth.uid() = blocker_id);
drop policy if exists blocks_insert_own on public.blocks;
create policy blocks_insert_own on public.blocks for insert to authenticated
    with check (auth.uid() = blocker_id);
drop policy if exists blocks_delete_own on public.blocks;
create policy blocks_delete_own on public.blocks for delete to authenticated
    using (auth.uid() = blocker_id);

-- Security definer so policies can check both directions without exposing
-- other users' block rows through `blocks_select_own`. It only answers for pairs
-- that include the caller, so it cannot be used to probe blocks between other users.
create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select auth.uid() in (a, b) and exists (
        select 1 from public.blocks
        where (blocker_id = a and blocked_id = b)
           or (blocker_id = b and blocked_id = a)
    );
$$;
revoke all on function public.is_blocked_between(uuid, uuid) from public;
grant execute on function public.is_blocked_between(uuid, uuid) to authenticated;

-- Messages: the existing participant check plus "no block between the two".
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert to authenticated with check (
    auth.uid() = sender_id and exists (
        select 1 from public.matches m
        where m.id = match_id
          and (auth.uid() = m.user_id_a or auth.uid() = m.user_id_b)
          and not public.is_blocked_between(m.user_id_a, m.user_id_b)
    )
);

-- Match requests: the existing requester check plus "no block between the two".
drop policy if exists matches_insert on public.matches;
create policy matches_insert on public.matches for insert to authenticated with check (
    auth.uid() = user_id_a
    and not public.is_blocked_between(user_id_a, user_id_b)
);
