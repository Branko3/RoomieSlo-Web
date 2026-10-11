# Favorite mutations against Supabase

- Status: Implemented
- Date: 2026-10-11
- Web surfaces: favorite hearts on listing cards and `/listings/[id]` (`useFavorites`), `/favorites`, `components/providers.tsx`
- Android behavior preserved: `FavoriteRepository`. Favorites are rows in `favorites (profile_id, listing_id)` for the signed-in user, added with an insert and removed with a delete filtered by `profile_id` and `listing_id`. The favorites screen loads the listings in one nested query using the same columns as the feed (`getMyFavorites`). RLS `favorites_all` (`auth.uid() = profile_id`) is the boundary.

## Behavior

- **Signed in:**
  - Favorites are read from and written to Supabase.
  - Toggling a heart updates immediately; the insert or delete runs in the background.
  - On failure only that listing is reverted (so another toggle made meanwhile is kept), and a dismissible alert explains why: re-login, listing deleted, offline, or generic.
  - Adding an existing favorite (`23505`) and removing a missing one are treated as success.
- **First sign-in on a browser with prototype favorites:**
  - Ids saved in `localStorage` (`roomieslo:favorites`) are uploaded once; listings deleted meanwhile (`23503`) are skipped.
  - The local copy is removed only when nothing failed for a temporary reason, so a network failure never loses them.
  - The server list then becomes the source of truth.
- **Signed out or Supabase not configured:** the existing browser-only favorites keep working (`localStorage`). On sign-out the hearts switch back to the browser list, which is empty after a successful upload, so the next person does not see the previous user's favorites.
- **Server list fails to load:** the browser list stays visible with an explanation instead of an empty page.
- **`/favorites`:**
  - signed in, the user's favorite listings come from the nested query, so favorites are no longer limited to the first 24 feed listings;
  - signed out, it matches browser favorites against the feed as before;
  - removals disappear immediately.

## Acceptance criteria

- [x] Signed-in users' favorites are stored in and loaded from Supabase with Android's insert, delete, and select semantics.
- [x] Toggling is optimistic with a per-listing rollback and a safe error message.
- [x] Prototype favorites from `localStorage` are migrated on sign-in without data loss on temporary failures.
- [x] Signed-out and unconfigured modes keep working locally; sign-out does not expose the previous user's favorites.
- [x] `/favorites` shows all of the signed-in user's favorites via one nested query.
- [ ] Verified against real RLS (`favorites_all`) and the listing foreign key in a browser (blocked: staging credentials and installed browsers).

## Implementation

- `lib/favorites/favorites-api.ts`:
  - `fetchFavoriteIds`, `fetchFavoriteListings` (`FAVORITE_WITH_LISTING` nested select), `addFavorite`, `removeFavorite`,
  - `toFavoriteError` (42501/401/403 → permission, 23503 → gone, network → offline).
- `lib/favorites/favorites-sync.ts` — `readLocalFavorites` (validates and de-duplicates), `adoptServerFavorites`, and `toggleFavoriteOptimistically(current, id, apply, persist, getCurrent)`.
- `components/providers.tsx`:
  - the favorites context now tracks the session (`getSession` plus `onAuthStateChange` for SIGNED_IN and SIGNED_OUT),
  - exposes `storage`, `userId`, `favoriteError`, and `dismissFavoriteError`,
  - renders the alert toast.
  - The existing `favorites` / `isFavorite` / `toggleFavorite` API is unchanged.
- `app/favorites/page.tsx` — uses the nested query when signed in (TanStack Query key `["favorites", "listings", userId]`); reformatted by Prettier.
- `app/globals.css` — `.favorite-toast`.
- Related open PRs: Logout (#19) also edits the favorites context (`resetFavorites`), so expect a merge conflict in `components/providers.tsx`; with this PR, signing out already switches favorites to the browser list. Listing deletion (#26) calls `toggleFavorite` to drop a deleted listing, which works with both modes.

## Testing contract

- Unit: query shapes and filters, the nested select and hidden listings, insert payload and duplicate success, delete filters, error mapping, API error propagation, local read/validation/corruption, migration (upload, skip deleted, keep on temporary failure, no-op, load failure), optimistic add/remove/rollback, concurrent toggles.
- Integration: RLS — users can only read and write their own favorites; deleted listings cascade (staging).
- End-to-end: favorite a listing, reload, see it persist; favorite while signed out, sign in, see it migrated; an offline toggle reverts with an alert.
- Manual: none beyond the above.

## Handoff to testing

All unit scenarios above; provider and page checks for mode switching on SIGNED_IN/SIGNED_OUT, the toast, and the `/favorites` remote list.

## Test status

- Automated status: Partially covered
- Test files: `tests/favorites.test.ts`
- Scenarios covered: all unit scenarios (22 tests, passing with `npm run test`).
- Remaining gaps: the provider's session handling and the `/favorites` page are not component-tested (no React Testing Library/jsdom in the repo); no browser run; RLS needs a staging project.
- Manual testing: Not run unless explicitly requested
