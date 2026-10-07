-- Source: RoomieSlo-App/supabase/migrations/0002_polja_za_prikaz.sql.
-- Existing rows retain their current values; nullable fields intentionally remain nullable.

alter table public.listings add column if not exists title text not null default '';
alter table public.listings add column if not exists room_type text not null default '';
alter table public.listings add column if not exists district text not null default '';
alter table public.listings add column if not exists available_from date;
alter table public.listings add column if not exists size_sqm integer;
alter table public.listings add column if not exists deposit numeric(10, 2);
alter table public.listings add column if not exists bills_included boolean not null default false;
alter table public.listings add column if not exists furnished boolean not null default false;
alter table public.listings add column if not exists flatmates_count integer not null default 0;
alter table public.listings add column if not exists photo_url text not null default '';

alter table public.profiles add column if not exists age integer;
alter table public.profiles add column if not exists faculty text not null default '';
alter table public.profiles add column if not exists bio text not null default '';
alter table public.profiles add column if not exists avatar_url text not null default '';

create index if not exists listings_available_type_idx
    on public.listings (room_type) where is_filled = false;
