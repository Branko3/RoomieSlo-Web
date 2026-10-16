-- Roommate ratings, part B of docs/nontechnical/cohabitation-and-ratings.md
-- (thresholds approved by the owner 2026-10-16). Builds on 20261016000000.
--
-- Only participants of a confirmed cohabitation rate each other, once per
-- cohabitation. Ratings are double-blind: hidden until both have rated, 14 days
-- after submission, or when the rating window closes. Only revealed ratings
-- from the last 36 months count, and a summary is shown only from 3 of them.
-- Nobody can ever see who gave which rating: raters read only their own rows,
-- and everyone else gets aggregates from security-definer functions.

-- Tag keys, in display (and tie-break) order. Labels live in lib/ratings/tags.ts.
create or replace function public.rating_strength_tags()
returns text[]
language sql
immutable
as $$
    select array['reliable_costs', 'clean_tidy', 'respects_quiet',
                 'good_communication', 'keeps_agreements', 'pleasant']::text[];
$$;

create or replace function public.rating_improvement_tags()
returns text[]
language sql
immutable
as $$
    select array['costs', 'cleanliness', 'noise',
                 'communication', 'agreements', 'visitors']::text[];
$$;

create table if not exists public.roommate_ratings (
    id uuid primary key default gen_random_uuid(),
    cohabitation_id uuid not null references public.cohabitations (id) on delete cascade,
    rater_id uuid not null references public.profiles (id) on delete cascade,
    rated_id uuid not null references public.profiles (id) on delete cascade,
    would_live_again boolean not null,
    strengths text[] not null default '{}',
    improvements text[] not null default '{}',
    status text not null default 'hidden' check (status in ('hidden', 'revealed')),
    -- First submission; reset only by a 6-month update of a revealed rating.
    submitted_at timestamptz not null default now(),
    revealed_at timestamptz,
    updated_at timestamptz not null default now(),
    constraint roommate_ratings_one_per_rater unique (cohabitation_id, rater_id),
    constraint roommate_ratings_distinct_users check (rater_id <> rated_id),
    constraint roommate_ratings_strengths_valid
        check (cardinality(strengths) <= 3 and strengths <@ public.rating_strength_tags()),
    constraint roommate_ratings_improvements_valid
        check (cardinality(improvements) <= 3 and improvements <@ public.rating_improvement_tags()),
    constraint roommate_ratings_revealed_at
        check ((status = 'revealed') = (revealed_at is not null))
);

create index if not exists roommate_ratings_rated_idx
    on public.roommate_ratings (rated_id) where status = 'revealed';
create index if not exists roommate_ratings_rater_idx on public.roommate_ratings (rater_id);

alter table public.roommate_ratings enable row level security;

-- Raters read only their own ratings. The rated person never reads rows; there
-- are no write policies, and API roles have no table write privileges.
revoke all on public.roommate_ratings from anon, authenticated;
grant select on public.roommate_ratings to authenticated;

drop policy if exists roommate_ratings_select_own on public.roommate_ratings;
create policy roommate_ratings_select_own on public.roommate_ratings for select to authenticated
    using (auth.uid() = rater_id);

-- Opt-out (GDPR right to object): on by default; users change their own row
-- through the existing profiles_update policy. The profile guards
-- (protect_academic_verification, protect_profile_tombstone) only pin their
-- own columns, so this column stays editable by its owner.
alter table public.profiles
    add column if not exists show_roommate_ratings boolean not null default true;

-- The rating window of a cohabitation: it opens 2 months after the move-in
-- month, or when the cohabitation ends if that's sooner, and closes 60 days
-- after the end (never while still living together). The end is when it was
-- recorded (`ended_at`), so a retroactive end month doesn't close it at once.
create or replace function public.rating_window_opens_at(c public.cohabitations)
returns timestamptz
language sql
stable
set search_path = public
as $$
    select least(
        (c.started_month + interval '2 months')::timestamp at time zone 'Europe/Ljubljana',
        c.ended_at
    );
$$;

create or replace function public.rating_window_closes_at(c public.cohabitations)
returns timestamptz
language sql
stable
set search_path = public
as $$
    select c.ended_at + interval '60 days';
$$;
revoke all on function public.rating_window_opens_at(public.cohabitations) from public, anon, authenticated;
revoke all on function public.rating_window_closes_at(public.cohabitations) from public, anon, authenticated;

-- Submit or update my rating of the other participant.
create or replace function public.submit_roommate_rating(
    p_cohabitation_id uuid,
    p_would_live_again boolean,
    p_strengths text[],
    p_improvements text[]
)
returns public.roommate_ratings
language plpgsql
security definer
set search_path = public
as $$
declare
    me uuid := auth.uid();
    c public.cohabitations;
    other uuid;
    v_strengths text[] := coalesce(p_strengths, '{}');
    v_improvements text[] := coalesce(p_improvements, '{}');
    existing public.roommate_ratings;
    saved public.roommate_ratings;
begin
    if me is null then
        raise exception 'not signed in' using errcode = '42501';
    end if;

    -- Lock the cohabitation so the two raters' submissions are serialized and
    -- the second one always sees the first (for the reveal below).
    select * into c from public.cohabitations where id = p_cohabitation_id for update;
    if not found or me not in (c.user_id_a, c.user_id_b) then
        raise exception 'cohabitation is unavailable or caller is not a participant'
            using errcode = '42501';
    end if;
    if c.status not in ('active', 'ended') or c.confirmed_at is null then
        raise exception 'cohabitation is not confirmed' using errcode = '42501';
    end if;
    other := case when me = c.user_id_a then c.user_id_b else c.user_id_a end;
    if public.is_deleted_profile(me) or public.is_deleted_profile(other) then
        raise exception 'a participant has deleted their account' using errcode = '42501';
    end if;

    -- Answers: Da/Ne is required; at most 3 distinct tags from each fixed set.
    if p_would_live_again is null then
        raise exception 'rating answer is required' using errcode = '22023';
    end if;
    if cardinality(v_strengths) > 3
       or not v_strengths <@ public.rating_strength_tags()
       or cardinality(v_strengths) <> (select count(distinct t) from unnest(v_strengths) t) then
        raise exception 'invalid rating tags: strengths' using errcode = '22023';
    end if;
    if cardinality(v_improvements) > 3
       or not v_improvements <@ public.rating_improvement_tags()
       or cardinality(v_improvements) <> (select count(distinct t) from unnest(v_improvements) t) then
        raise exception 'invalid rating tags: improvements' using errcode = '22023';
    end if;

    -- The window.
    if now() < public.rating_window_opens_at(c) then
        raise exception 'rating window is not open yet' using errcode = 'P0001';
    end if;
    if c.ended_at is not null and now() > public.rating_window_closes_at(c) then
        raise exception 'rating window has closed' using errcode = 'P0001';
    end if;

    select * into existing
    from public.roommate_ratings
    where cohabitation_id = c.id and rater_id = me;

    if not found then
        insert into public.roommate_ratings
            (cohabitation_id, rater_id, rated_id, would_live_again, strengths, improvements)
        values (c.id, me, other, p_would_live_again, v_strengths, v_improvements)
        returning * into saved;
    elsif existing.status = 'hidden' then
        -- Editable while hidden; the 14-day reveal still counts from the first submission.
        update public.roommate_ratings
        set would_live_again = p_would_live_again,
            strengths = v_strengths,
            improvements = v_improvements,
            updated_at = now()
        where id = existing.id
        returning * into saved;
    elsif c.status = 'active' and existing.submitted_at <= now() - interval '6 months' then
        -- Still living together: a revealed rating can be updated every 6 months;
        -- only the latest version counts.
        update public.roommate_ratings
        set would_live_again = p_would_live_again,
            strengths = v_strengths,
            improvements = v_improvements,
            submitted_at = now(),
            updated_at = now()
        where id = existing.id
        returning * into saved;
    else
        raise exception 'rating cannot be updated yet' using errcode = 'P0001';
    end if;

    -- Double-blind: once both have rated, both ratings are revealed.
    if (select count(*) from public.roommate_ratings where cohabitation_id = c.id) = 2 then
        update public.roommate_ratings
        set status = 'revealed', revealed_at = now()
        where cohabitation_id = c.id and status = 'hidden';
        select * into saved from public.roommate_ratings where id = saved.id;
    end if;

    return saved;
end;
$$;
revoke all on function public.submit_roommate_rating(uuid, boolean, text[], text[]) from public, anon;
grant execute on function public.submit_roommate_rating(uuid, boolean, text[], text[]) to authenticated;

-- Counts of tags over a set of ratings, most frequent first, ties in tag
-- order, optionally only the first p_limit (null = all).
create or replace function public.rating_tag_counts(p_tags text[], p_order text[], p_limit integer)
returns jsonb
language sql
immutable
as $$
    select coalesce(
        jsonb_agg(jsonb_build_object('tag', tag, 'count', n)
                  order by n desc, array_position(p_order, tag)),
        '[]'::jsonb)
    from (
        select tag, count(*)::integer as n
        from unnest(p_tags) as tag
        group by tag
        order by count(*) desc, array_position(p_order, tag)
        limit p_limit
    ) counted;
$$;
revoke all on function public.rating_tag_counts(text[], text[], integer) from public, anon, authenticated;

-- The ratings that count for a person: revealed, from the last 36 months,
-- and only each rater's latest one. A rater counts once however many
-- cohabitations the two declared, so one friend can't make up the threshold
-- of 3 by declaring, confirming and ending several times.
create or replace function public.counted_ratings(p_profile_id uuid)
returns table (would_live_again boolean, strengths text[], improvements text[])
language sql
stable
security definer
set search_path = public
as $$
    select distinct on (r.rater_id) r.would_live_again, r.strengths, r.improvements
    from public.roommate_ratings r
    where r.rated_id = p_profile_id
      and r.status = 'revealed'
      and r.submitted_at > now() - interval '36 months'
    order by r.rater_id, r.submitted_at desc;
$$;
revoke all on function public.counted_ratings(uuid) from public, anon, authenticated;

-- The public summary of a profile. Aggregates only; it never uses auth.uid(),
-- so the recommendations Edge Function (service role) can call it.
--   { state: 'hidden' }        the person turned ratings off
--   { state: 'insufficient' }  fewer than 3 raters counted, or a deleted profile
--   { state: 'shown', total, would_live_again, strengths: [{tag, count}] (top 3) }
create or replace function public.rating_summary(p_profile_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    p public.profiles;
    total integer;
    yes integer;
    tags text[];
begin
    select * into p from public.profiles where id = p_profile_id;
    if not found or p.deleted_at is not null then
        return jsonb_build_object('state', 'insufficient');
    end if;
    if not p.show_roommate_ratings then
        return jsonb_build_object('state', 'hidden');
    end if;

    select count(*)::integer,
           count(*) filter (where c.would_live_again)::integer,
           coalesce((select array_agg(t) from public.counted_ratings(p_profile_id) x, unnest(x.strengths) t), '{}')
    into total, yes, tags
    from public.counted_ratings(p_profile_id) c;
    if total < 3 then
        return jsonb_build_object('state', 'insufficient');
    end if;

    return jsonb_build_object(
        'state', 'shown',
        'total', total,
        'would_live_again', yes,
        'strengths', public.rating_tag_counts(tags, public.rating_strength_tags(), 3)
    );
end;
$$;
revoke all on function public.rating_summary(uuid) from public, anon;
grant execute on function public.rating_summary(uuid) to authenticated, service_role;

-- Summaries for many profiles in one call (the recommendations Edge Function).
create or replace function public.rating_summaries(p_profile_ids uuid[])
returns table (profile_id uuid, summary jsonb)
language sql
stable
security definer
set search_path = public
as $$
    select id, public.rating_summary(id) from unnest(p_profile_ids) as id;
$$;
revoke all on function public.rating_summaries(uuid[]) from public, anon, authenticated;
grant execute on function public.rating_summaries(uuid[]) to service_role;

-- The caller's own aggregate, including the private improvement tags. Same
-- counted ratings and threshold; below it only the count is returned.
--   { state: 'insufficient', count, visible }
--   { state: 'shown', total, would_live_again, strengths (top 3), improvements (all), visible }
create or replace function public.my_rating_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    me uuid := auth.uid();
    visible boolean;
    total integer;
    yes integer;
    strength_tags text[];
    improvement_tags text[];
begin
    if me is null then
        raise exception 'not signed in' using errcode = '42501';
    end if;
    select coalesce(show_roommate_ratings, true) into visible from public.profiles where id = me;

    select count(*)::integer,
           count(*) filter (where c.would_live_again)::integer,
           coalesce((select array_agg(t) from public.counted_ratings(me) x, unnest(x.strengths) t), '{}'),
           coalesce((select array_agg(t) from public.counted_ratings(me) x, unnest(x.improvements) t), '{}')
    into total, yes, strength_tags, improvement_tags
    from public.counted_ratings(me) c;
    if total < 3 then
        return jsonb_build_object('state', 'insufficient', 'count', total,
                                  'visible', coalesce(visible, true));
    end if;

    return jsonb_build_object(
        'state', 'shown',
        'total', total,
        'would_live_again', yes,
        'strengths', public.rating_tag_counts(strength_tags, public.rating_strength_tags(), 3),
        'improvements', public.rating_tag_counts(improvement_tags, public.rating_improvement_tags(), null),
        'visible', coalesce(visible, true)
    );
end;
$$;
revoke all on function public.my_rating_summary() from public, anon;
grant execute on function public.my_rating_summary() to authenticated;

-- Account deletion: the full body of handle_deleted_user from
-- 20261016000000_cohabitations.sql, plus deleting the ratings the user received.
-- Ratings the user gave stay in the other person's aggregate, linked only to
-- the tombstone, until the retention job removes them.
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

    -- Ratings (approved 2026-10-16): the ones this user received are deleted.
    delete from public.roommate_ratings where rated_id = old.id;

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
-- 20261016000000_cohabitations.sql, plus the rating reveal and expiry rules.
create or replace function public.purge_expired_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    reports_purged integer;
    ratings_revealed integer;
    ratings_purged integer;
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

    -- Ratings: reveal a hidden rating 14 days after submission, or once the
    -- rating window has closed (approved 2026-10-16).
    update public.roommate_ratings r
    set status = 'revealed', revealed_at = now()
    from public.cohabitations c
    where c.id = r.cohabitation_id
      and r.status = 'hidden'
      and (r.submitted_at <= now() - interval '14 days'
           or (c.ended_at is not null and public.rating_window_closes_at(c) <= now()));
    get diagnostics ratings_revealed = row_count;

    -- Ratings: deleted 36 months after the cohabitation ended, or after the
    -- latest submission while it's still active.
    delete from public.roommate_ratings r
    using public.cohabitations c
    where c.id = r.cohabitation_id
      and ((c.ended_at is not null and c.ended_at < now() - interval '36 months')
           or (c.ended_at is null and r.submitted_at < now() - interval '36 months'));
    get diagnostics ratings_purged = row_count;

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
      and not exists (select 1 from public.cohabitations c where p.id in (c.user_id_a, c.user_id_b))
      and not exists (select 1 from public.roommate_ratings q where p.id in (q.rater_id, q.rated_id));
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
        'ratings_revealed', ratings_revealed,
        'ratings', ratings_purged,
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
