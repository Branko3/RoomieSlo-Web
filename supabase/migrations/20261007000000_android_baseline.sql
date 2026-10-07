-- RoomieSlo web migration ownership begins here.
-- Source: RoomieSlo-App/supabase/schema.sql and auth_trigger.sql.
-- Auth users remain in Supabase's managed auth.users table.

create table if not exists public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    display_name text not null default '',
    academic_status_verified boolean not null default false,
    is_available boolean not null default true,
    created_at timestamptz not null default now()
);

create table if not exists public.questionnaire_answers (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid not null references public.profiles (id) on delete cascade,
    question_id text not null,
    value real not null,
    weight real not null default 1,
    unique (profile_id, question_id)
);

create table if not exists public.listings (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references public.profiles (id) on delete cascade,
    location text not null,
    price_per_month numeric(10,2) not null,
    description text not null default '',
    is_filled boolean not null default false,
    version integer not null default 1,
    created_at timestamptz not null default now()
);

create table if not exists public.matches (
    id uuid primary key default gen_random_uuid(),
    user_id_a uuid not null references public.profiles (id) on delete cascade,
    user_id_b uuid not null references public.profiles (id) on delete cascade,
    status text not null default 'pending'
        check (status in ('pending', 'accepted', 'rejected')),
    version integer not null default 1,
    created_at timestamptz not null default now()
);

create table if not exists public.messages (
    id uuid primary key default gen_random_uuid(),
    match_id uuid not null references public.matches (id) on delete cascade,
    sender_id uuid not null references public.profiles (id) on delete cascade,
    body text not null,
    delivery_status text not null default 'sent'
        check (delivery_status in ('sent', 'delivered', 'read')),
    sent_at timestamptz not null default now()
);

create table if not exists public.favorites (
    profile_id uuid not null references public.profiles (id) on delete cascade,
    listing_id uuid not null references public.listings (id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (profile_id, listing_id)
);

create table if not exists public.reports (
    id uuid primary key default gen_random_uuid(),
    reporter_id uuid not null references public.profiles (id) on delete cascade,
    reported_id uuid not null references public.profiles (id) on delete cascade,
    reason text not null,
    description text not null default '',
    status text not null default 'open'
        check (status in ('open', 'reviewed', 'dismissed')),
    created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, display_name)
    values (new.id, coalesce(new.raw_user_meta_data->>'display_name', ''))
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

do $$
begin
    if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
        execute 'create publication supabase_realtime';
    end if;
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public' and tablename = 'messages'
    ) then
        execute 'alter publication supabase_realtime add table public.messages';
    end if;
end $$;
