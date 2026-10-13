-- Listing versions and the feed's keyset index.
-- 1. Android edits listings (and toggles is_filled) without touching `version`, so
--    the web's optimistic edit check could not see those changes. The database
--    now bumps the version on every change, whoever makes it. The web edit
--    already sends old.version + 1, which gives the same result.
-- 2. The feed pages by (created_at desc, id desc) over available listings; this
--    index serves that order and the keyset condition, and replaces the
--    created_at-only partial index (same prefix, same predicate).

create or replace function public.bump_listing_version()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    if (to_jsonb(new) - 'version') is distinct from (to_jsonb(old) - 'version') then
        new.version := old.version + 1;
    else
        new.version := old.version;
    end if;
    return new;
end;
$$;
revoke all on function public.bump_listing_version() from public;

drop trigger if exists bump_listing_version on public.listings;
create trigger bump_listing_version
    before update on public.listings
    for each row execute function public.bump_listing_version();

create index if not exists listings_available_created_id_idx
    on public.listings (created_at desc, id desc) where is_filled = false;
drop index if exists public.listings_available_created_idx;
