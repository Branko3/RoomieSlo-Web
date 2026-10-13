# Search feed cache write-through

- Status: Implemented
- Date: 2026-10-13
- Web surfaces: `/search` (`lib/listings/use-listing-pages.ts`), `lib/listings/cache-sync.ts`
- Android behavior preserved: Android caches every listing page it fetches (`syncListings`) for the signed-in user, and drops rows older than 7 days. The paged web feed now does the same.

## Behavior

- Every page `/search` loads (the first page and every "Naloži več") is written to the IndexedDB listing cache for the signed-in user, as `/listings` already did. Before, the cache was only filled from `/listings`, so a user who only used `/search` had nothing to show offline.
- Writing is best effort: no session, a full quota or an IndexedDB error never affects the page. A failed fetch writes nothing and surfaces its error as before.

## Acceptance criteria

- [x] Each fetched `/search` page is cached for the session user.
- [x] Cache failures never affect the feed.
- [x] Fetch errors propagate unchanged and cache nothing.

## Implementation

- `fetchPageAndCache(fetchPage, readUserId, store)` in `lib/listings/cache-sync.ts` returns the page and starts `writeListingsToCache` without waiting for it.
- `useListingPages` wraps `fetchListingsPage` with it. `readSessionUserId` is now exported from `lib/supabase/hooks.ts` and shared.
- `/search` first-load JS: 193.8 kB of 200 (+0.3 kB).

## Testing contract

- Unit: `tests/listing-cache.test.ts`: page returned and cached, cache failure ignored, fetch error propagated with nothing cached.
- End-to-end: offline `/search` after paging shows cached rows (needs browsers and staging).

## Handoff to testing

- Sign in, load two `/search` pages, go offline and reload: the cached-listings notice shows the listings from both pages.

## Test status

- Automated status: Partially covered
- Test files: `tests/listing-cache.test.ts`
- Scenarios covered: write-through, failure isolation, error propagation
- Remaining gaps: browser offline run with a native IndexedDB
- Manual testing: Not run unless explicitly requested
