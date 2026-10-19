# My listings ("Moji oglasi")

- Status: Implemented
- Date: 2026-10-20
- Web surfaces: `/listings/mine`; the dashboard shortcut on `/listings`; the "Moji oglasi" row on `/profile`; the owner strip on `/listings/[id]`; the `/listings` and `/search` feeds.
- Android: no schema or policy change; Android keeps working unchanged.

## Problem

The user's own listings appeared in the browsing feeds next to everyone else's, and there was no list of them. Both feeds only show `is_filled = false`, so a listing marked "Zapolnjeno" could only be reached again through its URL.

## Behavior

- **Feeds leave out your own listings.** `/listings` ("Priporočeni oglasi") and `/search` add `owner_id <> <signed-in user>`. Cached offline listings are filtered the same way, since the cache may hold rows from before this change. Other people's listings are unchanged.
- **`/listings/mine`** lists every listing you own, filled ones included: available first, then newest (at most 50).
  - Each card is the flyer with its status chip ("Na voljo" / "Zapolnjeno"), rent and publish date, plus "Uredi" and the filled/available toggle. Your own listings have no favourite heart.
  - Toggling updates the card in place; the list does not regroup, so keyboard focus stays on the button.
  - The header shows the count ("2 aktivna oglasa, 1 zapolnjen") and "Objavi oglas". The empty state invites posting.
  - Deleting stays on the detail page, which has the confirmation step.
- **Entry points:**
  - the dashboard shows a "Moji oglasi" row under the hero once you have at least one listing;
  - the profile's settings panel always has a "Moji oglasi" row;
  - your own listing's detail page shows "Uredi oglas" and "Vsi moji oglasi".
- **Navigation:** `/listings/mine` belongs to "Oglasi"; the bottom navigation keeps five items. The route is guarded like every non-public route.

## Acceptance criteria

- [x] Your own listings never appear in `/listings` or `/search`, from the network or the offline cache.
- [x] `/listings/mine` shows all of your listings, including filled ones, with their status.
- [x] The owner can edit a listing and switch it between available and filled from the list.
- [x] Loading, error (with retry) and empty states.
- [x] Entry points from the dashboard, the profile and the listing's detail page.
- [x] Other users still see the listing in their feeds.
- [ ] Index migration applied to the connected Supabase project (performance only; pending the migration decision in `web-feature-status.md`).

## Implementation

- `lib/listings/pagination.ts`, `lib/supabase/queries.ts`: `excludeOwnerId` adds `.neq("owner_id", …)`; the feeds pass the user id from the local session (`readSessionUserId`, no network). Sign-out clears the query cache, so the feed key needs no user id.
- `lib/listings/listing-cache.ts`, `lib/listings/offline-listings.ts`: `excludeOwnerId` on cached reads; `excludeOwnListings` on the fallback loader for browsing feeds.
- `lib/listings/my-listings.ts`: `fetchMyListings(client, ownerId)`, `groupMyListings`, Slovenian count labels and the header summary.
- `lib/listings/use-my-listings.ts`: a plain `useState`/`useEffect` hook like `useListings`, with `setFilled` for in-place status updates; it loads on every mount. A TanStack `useQuery` here regrouped Query's shared chunks and pushed `/chats/[matchId]` over the first-load budget.
- **Bundle budget:** adding the `/listings/mine` entry made Next's chunk splitting duplicate three TanStack Query modules into two chunks of `/chats/[matchId]` (197.7 → 200.5 kB, budget 200). The chat page now loads `ChatCohabitation` and `ChatRating` with `next/dynamic`: both are secondary, appear only for accepted matches and fetch their own data. The route ends at 193.0 kB, below `main`.
- `components/listing-status-control.tsx`: split into `ListingStatusToggle` (no owner check) and `ListingStatusControl` (owner check + toggle), so the list does not make one `getUser()` call per card.
- `components/own-listing-card.tsx`: the owner's flyer variant (a separate component, not an `isOwner` flag on `ListingCard`).
- `components/my-listings-links.tsx`: dashboard shortcut and profile row; `components/owner-listing-actions.tsx`: "Vsi moji oglasi" link.
- `supabase/migrations/20261020000000_listings_owner_index.sql`: `(owner_id, created_at desc, id desc)` index. No RLS change: `listings_select` already allows signed-in reads, and update/delete are owner-only.

## Testing contract

- Unit: the exclude filter is added only with a user id (paged feed, dashboard query, cache read, offline fallback); `fetchMyListings` query shape, no `is_filled` filter, guard, errors; grouping; Slovenian plurals; summary.
- Component: `/listings/mine` loading, error with retry, empty, list with status and owner actions, in-place toggle.
- End-to-end (signed in): the page lists own listings with status and edit links; none of them appear on `/search` or `/listings`. `/listings/mine` is in the axe and responsive page lists.
