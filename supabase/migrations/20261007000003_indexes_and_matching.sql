-- Source: RoomieSlo-App/supabase/migrations/0001_indeksi.sql.
-- This migration also makes duplicate match requests impossible and exposes an
-- atomic, participant-only acceptance operation for the web contract.

create extension if not exists pg_trgm;
create index if not exists listings_available_created_idx on public.listings (created_at desc) where is_filled = false;
create index if not exists listings_available_price_idx on public.listings (price_per_month) where is_filled = false;
create index if not exists listings_location_trgm_idx on public.listings using gin (location gin_trgm_ops);
create index if not exists messages_match_sent_idx on public.messages (match_id, sent_at);
create index if not exists matches_user_a_idx on public.matches (user_id_a, created_at desc);
create index if not exists matches_user_b_idx on public.matches (user_id_b, created_at desc);
create unique index if not exists questionnaire_answers_profile_question_idx
    on public.questionnaire_answers (profile_id, question_id);
create index if not exists profiles_available_idx on public.profiles (id) where is_available = true;

do $$
begin
    if exists (
        select 1 from public.matches a
        join public.matches b on a.id <> b.id
          and least(a.user_id_a, a.user_id_b) = least(b.user_id_a, b.user_id_b)
          and greatest(a.user_id_a, a.user_id_b) = greatest(b.user_id_a, b.user_id_b)
    ) then
        raise exception 'Cannot create unique match protection: duplicate match pairs exist';
    end if;
end $$;

alter table public.matches
    drop constraint if exists matches_distinct_users;
alter table public.matches
    add constraint matches_distinct_users check (user_id_a <> user_id_b);
create unique index if not exists matches_user_pair_idx
    on public.matches (least(user_id_a, user_id_b), greatest(user_id_a, user_id_b));

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
    set status = 'accepted', version = version + 1
    where id = p_match_id
      and status = 'pending'
      and (auth.uid() = user_id_a or auth.uid() = user_id_b)
    returning * into accepted;
    if not found then
        raise exception 'match is unavailable or caller is not a participant';
    end if;
    return accepted;
end;
$$;
revoke all on function public.accept_match(uuid) from public;
grant execute on function public.accept_match(uuid) to authenticated;
