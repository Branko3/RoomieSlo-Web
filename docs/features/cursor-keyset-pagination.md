# Cursor/keyset pagination

- Status: Implemented
- Date: 2026-10-11
- Web surfaces: `/search` results with "Naloži več oglasov", `lib/listings/pagination.ts`, `lib/listings/use-listing-pages.ts`
- Android behavior preserved: `ListingRepository.getListingsPage`/`syncAllPage` page the available-listings feed newest first by `created_at` with a page size of 20 (`VELIKOST_STRANI`), using the last row's `created_at` as the next cursor. The web keeps the same ordering, page size, and `created_at`-based keyset, with two hardening changes listed below.

## Behavior

- `/search` loads the first 20 available listings (`is_filled = false`) matching the location and maximum-price filters, newest first.
- When more exist, a "Naloži več oglasov" button loads the next page and appends it; it shows "Nalaganje …" and is disabled while loading.
- Changing a filter starts again from the first page (the filters are part of the query key).
- A failed first page shows the existing page error. A failed "load more" keeps the loaded results and shows an inline alert, and the button retries.
- The existing empty state appears only when there are no results and no further pages.

## Acceptance criteria

- [x] The feed is paged by keyset on `created_at` (newest first), not by offset.
- [x] Listings with identical `created_at` are never skipped or repeated across pages (`id` tie-breaker).
- [x] The end of the feed is detected without an extra empty request.
- [x] Location and price filters apply to every page.
- [x] Users can load further pages; loading and load-more errors are handled without losing loaded results.
- [ ] Verified against a real Supabase project (PostgREST `or` filter with quoted timestamps; blocked: staging credentials).
- [ ] Composite index `(created_at desc, id desc) where is_filled = false` for the tie-breaker (recommended schema follow-up; the existing `listings_available_created_idx` covers the main ordering).

## Implementation

- `lib/listings/pagination.ts`:
  - `fetchListingsPage(client, { location, maxPrice, cursor, pageSize })` uses the order `created_at desc, id desc`, requests `limit(pageSize + 1)` to detect a further page, and applies the keyset `or(created_at.lt."T",and(created_at.eq."T",id.lt."ID"))`.
  - Rows are validated with the existing `mapListing`.
  - Helpers: `cursorFilter` (values quoted per PostgREST rules), `quoteFilterValue`, `clampPageSize` (1–50, default 20), and `flattenPages` (de-duplicates by id).
- `lib/listings/use-listing-pages.ts` — TanStack Query `useInfiniteQuery` (the existing provider), with query key `["listings", "feed", location, maxPrice]`.
- `app/search/page.tsx` — uses the paged hook and the load-more control (the file was reformatted by Prettier). Client-side sorting and the district filter still apply to the loaded results; price sorting therefore orders only what is loaded, as before.
- `app/globals.css` — `.load-more` and `.error-message` (the same `.error-message` rule appears in other open PRs; keep one when merging).
- Differences from Android:
  - the `id` tie-breaker prevents skipping rows that share a timestamp,
  - the extra-row probe replaces "fewer rows than requested" so a full last page does not need an empty follow-up request.
  - Offline caching and stale-row cleanup belong to the separate IndexedDB/offline features.

## Testing contract

- Unit: query shape and order, the extra-row limit, optional filters, backend error passthrough, malformed rows, complete newest-first traversal with ties for every page size 1–7, no extra request on an exact final page, the next cursor, the empty feed, filters on later pages, page-size clamping, quoting and escaping, the keyset string, de-duplication.
- Integration: the same traversal against a real PostgREST endpoint (staging).
- End-to-end: search, load more until the end, change a filter and confirm the reset; a load-more failure keeps the results.
- Manual: none beyond the above.

## Handoff to testing

All unit scenarios above (implemented with an in-memory PostgREST fake that applies the generated keyset filter); component checks for the load-more button, the pending state, the inline error, and the empty state.

## Test status

- Automated status: Partially covered
- Test files: `tests/listing-pagination.test.ts`
- Scenarios covered: all unit scenarios (14 tests, passing with `npm run test`).
- Remaining gaps: the search-page load-more UI is not component-tested (no React Testing Library/jsdom in the repo); no Playwright run (no installed browsers); the PostgREST filter syntax is verified only against the fake, not a real project; the composite index is not added.
- Manual testing: Not run unless explicitly requested
