-- Chat and match authorization (web feature "Chat and match authorization").
-- Closes three gaps that the web UI only hid:
--   1. the requester could accept (or reject) their own match request;
--   2. messages could be sent in a match that was not accepted;
--   3. a participant could rewrite the other person's message (body, sender, match).
-- Android stays compatible: it answers requests with a conditional update as the
-- recipient, sends only in accepted chats, and updates only `delivery_status` of
-- the other person's messages.

-- Matches: only the recipient (user_id_b) may answer, and only a pending request.
drop policy if exists matches_update on public.matches;
create policy matches_update on public.matches for update to authenticated
    using (auth.uid() = user_id_b and status = 'pending')
    with check (auth.uid() = user_id_b and status in ('accepted', 'rejected'));

-- API callers may only change `status`; the version is bumped on every answer so
-- clients (Android included, which never sends it) can detect the change.
create or replace function public.guard_match_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if coalesce(auth.role(), '') = 'authenticated' then
        if new.id is distinct from old.id
           or new.user_id_a is distinct from old.user_id_a
           or new.user_id_b is distinct from old.user_id_b
           or new.created_at is distinct from old.created_at then
            raise exception 'only the status of a match can be changed'
                using errcode = '42501';
        end if;
        if new.status is distinct from old.status then
            new.version := old.version + 1;
        else
            new.version := old.version;
        end if;
    end if;
    return new;
end;
$$;
revoke all on function public.guard_match_update() from public;

drop trigger if exists guard_match_update on public.matches;
create trigger guard_match_update
    before update on public.matches
    for each row execute function public.guard_match_update();

-- accept_match is security definer (RLS does not apply inside it), so the
-- recipient check is repeated here. The version bump comes from the trigger.
create or replace function public.accept_match(p_match_id uuid)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
    accepted public.matches;
begin
    update public.matches
    set status = 'accepted'
    where id = p_match_id
      and status = 'pending'
      and auth.uid() = user_id_b
    returning * into accepted;
    if not found then
        raise exception 'match is unavailable or caller is not a participant';
    end if;
    return accepted;
end;
$$;
revoke all on function public.accept_match(uuid) from public;
grant execute on function public.accept_match(uuid) to authenticated;

-- Messages: only in an accepted match, as yourself, with no block between the two.
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert to authenticated with check (
    auth.uid() = sender_id and exists (
        select 1 from public.matches m
        where m.id = match_id
          and m.status = 'accepted'
          and (auth.uid() = m.user_id_a or auth.uid() = m.user_id_b)
          and not public.is_blocked_between(m.user_id_a, m.user_id_b)
    )
);

-- Only the recipient updates a message, and only to mark it delivered or read.
drop policy if exists messages_update on public.messages;
create policy messages_update on public.messages for update to authenticated
    using (
        sender_id <> auth.uid() and exists (
            select 1 from public.matches m
            where m.id = messages.match_id
              and (auth.uid() = m.user_id_a or auth.uid() = m.user_id_b)
        )
    )
    with check (
        sender_id <> auth.uid() and exists (
            select 1 from public.matches m
            where m.id = messages.match_id
              and (auth.uid() = m.user_id_a or auth.uid() = m.user_id_b)
        )
    );

-- API callers may change `delivery_status` only, and never backwards
-- (sent -> delivered -> read).
create or replace function public.guard_message_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if coalesce(auth.role(), '') = 'authenticated' then
        if new.id is distinct from old.id
           or new.match_id is distinct from old.match_id
           or new.sender_id is distinct from old.sender_id
           or new.body is distinct from old.body
           or new.sent_at is distinct from old.sent_at then
            raise exception 'only the delivery status of a message can be changed'
                using errcode = '42501';
        end if;
        if array_position(array['sent', 'delivered', 'read'], new.delivery_status)
           < array_position(array['sent', 'delivered', 'read'], old.delivery_status) then
            raise exception 'delivery status cannot move backwards'
                using errcode = '42501';
        end if;
    end if;
    return new;
end;
$$;
revoke all on function public.guard_message_update() from public;

drop trigger if exists guard_message_update on public.messages;
create trigger guard_message_update
    before update on public.messages
    for each row execute function public.guard_message_update();
