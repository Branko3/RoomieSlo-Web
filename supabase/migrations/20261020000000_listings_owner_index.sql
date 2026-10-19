-- "Moji oglasi" loads one owner's listings (filled ones included), newest
-- first. Performance only: the feature works without it, and no policy or
-- column changes. Browsing feeds exclude the owner with `owner_id <> uid`,
-- which keeps using the partial `is_filled = false` keyset index.
create index if not exists listings_owner_created_idx
    on public.listings (owner_id, created_at desc, id desc);
