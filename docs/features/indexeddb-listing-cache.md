# IndexedDB listing cache

- Status: Implemented
- Date: 2026-10-11
- Web surfaces: `lib/listings/listing-cache.ts`, `lib/listings/indexeddb-store.ts`, `lib/listings/cache-sync.ts`; write-through in `lib/supabase/hooks.ts` (`useListings`, used by `/listings`, `/search`, `/favorites`)
- Android behavior preserved: Room `ListingDao` and `ListingRepository` caching. Only listings are cached:
  - search pages are upserted and rows older than 7 days are dropped (`syncListings` with `STALE_AFTER_MS`),
  - a full unfiltered sync replaces the set (`replaceAll`),
  - reads filter by location substring and maximum price, newest first, with a limit (`observeListings`),
  - the cache is never written or cleared without a session ("brez seje bi replaceAll() pobrisal predpomnilnik").

## Behavior

- Every successful `useListings` fetch is written to the browser cache for the signed-in user (best effort, after the fresh data is shown). Without a session, or if storage fails (quota, private mode), nothing happens and the page is unaffected.
- Rows from other searches are kept and only expire by age (7 days). An exact full result can replace the set via `replaceCachedListings`, which removes listings the server no longer returns. It is not wired to a fetch yet because current queries are limited; it is reserved for a full background sync.
- The cache belongs to one user. If a different user signs in on the same browser, the previous cache is discarded before use, and reads for another user or a signed-out visitor return nothing.
- Reads return available listings (`isFilled = false`) matching a case-insensitive location substring and maximum price, ordered by `createdAt` desc with an id tie-breaker, limited. `lastSyncedAt()` supports "last updated" copy.
- Storage is a native IndexedDB database `roomieslo-cache` (v1, stores `listings` keyed by id and `meta` for the owner). Upgrades start clean because the cache is rebuildable (Android `fallbackToDestructiveMigration`). Without IndexedDB (server rendering, some private modes) an in-memory store is used so callers never branch.

## Acceptance criteria

- [x] Only listings are cached, in IndexedDB, after successful authenticated fetches.
- [x] Filtered pages upsert without deleting other searches; rows older than 7 days are dropped.
- [x] A full authenticated result can replace the cache, including the authenticated-empty case.
- [x] An unauthenticated or failed response never writes, replaces, or empties the cache.
- [x] Cached reads match Android filtering, ordering, and limits and are scoped to the signed-in user.
- [x] Storage failures never affect the page.
- [ ] Showing cached listings when offline or stale (separate feature "Stale-cache and offline listing view", which consumes `readCachedListings`).
- [ ] The native IndexedDB adapter exercised in a real browser (blocked: no Playwright browsers; Node has no IndexedDB and `fake-indexeddb` is not a dependency).

## Implementation

- `lib/listings/listing-cache.ts`:
  - store interface, `cacheListingsPage`, `replaceCachedListings`, `removeCachedListing`, `readCachedListings`, and `lastSyncedAt`,
  - the per-user ownership check,
  - `createMemoryListingStore`.
- `lib/listings/indexeddb-store.ts` — dependency-free IndexedDB adapter (promise wrappers, destructive upgrade) and `getListingCacheStore()` with memory fallback.
- `lib/listings/cache-sync.ts` — `writeListingsToCache(listings, readUserId, store)` swallows session and storage errors.
- `lib/supabase/hooks.ts` — `useListings` writes successful results to the cache; the user id comes from the locally stored session (`auth.getSession`, no network). The file was reformatted by Prettier.
- Logout (PR #19) clears `roomieslo:` localStorage keys; this cache is protected by owner scoping instead, and a later change can call `store.clear()` on sign-out.
- No new npm dependency was added (Dexie was considered; a small adapter keeps the bundle and supply chain unchanged).

## Testing contract

- Unit: write for the session user, no-session no-op, stale cutoff (just over, exact boundary), upsert without duplicates, user switch, full replace, authenticated empty replace, unauthenticated empty no-op, read filters/order/limit/tie-breaker, other-user and signed-out reads, last sync time, single removal, write-through success, no session, swallowed failures, memory fallback.
- Integration: the IndexedDB adapter in a browser — persistence across reloads, upgrade path, quota errors.
- End-to-end: load listings, go offline, reload, confirm cached data is available to the offline view (with the offline feature).
- Manual: none beyond the above.

## Handoff to testing

All unit scenarios above; browser checks for the IndexedDB adapter once Playwright browsers are available.

## Test status

- Automated status: Partially covered
- Test files: `tests/listing-cache.test.ts`
- Scenarios covered: all unit scenarios (19 tests, passing with `npm run test`).
- Remaining gaps: the native IndexedDB adapter is not exercised (no IndexedDB in Node, no Playwright browsers); offline reading is a separate feature.
- Manual testing: Not run unless explicitly requested
