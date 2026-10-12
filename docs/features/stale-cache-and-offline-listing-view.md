# Stale-cache and offline listing view

- Status: Implemented
- Date: 2026-10-11
- Web surfaces: `/listings` and `/search` (`useOfflineListings`), `components/cache-notice.tsx`, `lib/listings/offline-listings.ts`
- Android behavior preserved: the listing screens observe the Room cache and keep showing cached listings when a refresh fails ("Ce predpomnilnik se ni prazen, napaka ni usodna -- povemo le, da so podatki shranjeni"). The cache is never cleared without a session. The web shows the IndexedDB cache from the "IndexedDB listing cache" feature in the same situations.

## Behavior

- Online: listings are fetched from Supabase as before and written to the cache for the signed-in user (best effort).
- A successful response always wins, even when empty. An unauthenticated empty response never writes to or clears the cache, so it cannot hide valid cached data later.
- Refresh failure: if the request fails and the signed-in user has cached listings matching the same location and price filters, they are shown with a notice: "Oglasov trenutno ni mogoče osvežiti. Prikazujemo shranjene oglase (zadnja posodobitev: …)" and a "Poskusi znova" button.
- Offline (`navigator.onLine === false`): the network is skipped (no waiting for a timeout) and cached listings are shown with "Brez povezave. Prikazujemo shranjene oglase (zadnja posodobitev: …)". When the browser fires `online`, the list reloads automatically.
- No cache: the existing error state is shown with a retry button; offline it explains that there is no connection and no saved listings.
- The "last updated" time is "pravkar", "pred N min", or a Slovenian date and time (Europe/Ljubljana).
- Another user's cache and a signed-out visitor never see cached listings.

## Acceptance criteria

- [x] Cached listings are shown when the network request fails or the browser is offline, with a clear stale/offline notice and the last update time.
- [x] Fresh responses (including empty ones) replace the cached view; unauthenticated empty responses never erase cached data.
- [x] Cached results respect the same location and price filters, newest first, available only.
- [x] Without cached data, the error state explains the problem and offers retry; the list reloads when the connection returns.
- [x] Cached data is scoped to the signed-in user.
- [ ] Verified in a real browser offline (DevTools offline mode / Playwright `context.setOffline`; blocked: no installed browsers).

## Implementation

- `lib/listings/offline-listings.ts`:
  - `loadListingsWithFallback({ fetchFresh, readUserId, store, query, isOnline })` returns a `ListingsView` of `network`, `cache` (with `syncedAt` and `offline`), or `error`,
  - `formatSyncedAt`, `cacheNotice`.
- `lib/listings/use-offline-listings.ts` — hook with the same query shape as `useListings`, the `online` listener, and `retry`.
- `components/cache-notice.tsx` — `role="status"` notice with retry.
- `app/listings/page.tsx`, `app/search/page.tsx` — use the hook, the notice, and retry (both files reformatted by Prettier). `app/listings/page.tsx` also gains `"use client"`: it calls a hook but lacked the directive on `main`.
- Shared with **IndexedDB listing cache (PR #29)**: `lib/listings/listing-cache.ts`, `lib/listings/indexeddb-store.ts`, and `lib/listings/cache-sync.ts` are byte-identical copies, so the two PRs merge cleanly in either order.
- `/favorites` still uses `useListings`; offline favorites belong to "Favorite mutations against Supabase".

## Testing contract

- Unit: fresh view and cache refresh, empty fresh response wins, unauthenticated empty response keeps the cache, failure → cache with sync time, offline skips network, filters on cached data, no cache → original error, other user / signed out → error, broken cache keeps the original error, non-Error failures, time formatting, notice copy for offline / refresh failure / fresh / error.
- Integration: IndexedDB persistence across reloads (browser).
- End-to-end: load `/listings`, go offline, reload → cached listings and the offline notice; back online → the list refreshes.
- Manual: none beyond the above.

## Handoff to testing

All unit scenarios above; component and browser checks for the notice, the retry button, and the `online` reload.

## Test status

- Automated status: Partially covered
- Test files: `tests/offline-listings.test.ts` (cache-layer tests live in PR #29)
- Scenarios covered: all unit scenarios (12 tests, passing with `npm run test`).
- Remaining gaps: the hook, notice, and `online` reload are not component-tested (no React Testing Library/jsdom); no browser offline run (no installed browsers); the native IndexedDB adapter is untested (see PR #29).
- Manual testing: Not run unless explicitly requested

## Merge note (2026-10-12)

`/search` now uses the paged TanStack Query feed from #28, so it doesn't use `useOfflineListings`.
Instead, `useCachedListingsFallback` (`lib/listings/use-offline-listings.ts`) loads the same cached
view when the first page fails or the browser is offline. While offline with no cache, `/search`
shows the offline state instead of a paused spinner. `/listings` uses `useOfflineListings` with
#12's data-state components. Not component-tested (no RTL); a browser offline run is still owed.
