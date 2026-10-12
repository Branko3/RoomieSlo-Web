# Owner listing editing

- Status: Implemented
- Date: 2026-10-11
- Web surfaces: `/listings/[id]/edit`, "Uredi oglas" on `/listings/[id]` (owner only), `components/owner-listing-actions.tsx`, the shared `components/listing-form.tsx`
- Android behavior preserved: `CreateListingViewModel` in edit mode and `ListingRepository.updateListing`. The form is prefilled the same way (whole euros, empty optional fields, flatmates 0 shown empty), validated with the same rules as creation, and the same owner-editable columns are updated.

## Behavior

- On `/listings/[id]` the owner sees "Uredi oglas"; other users never see it. This is only UI; RLS (`auth.uid() = owner_id`) is the boundary.
- `/listings/[id]/edit` loads the listing's editable columns and states:
  - loading,
  - signed out (link to `/login`),
  - not found or deleted,
  - not the owner ("Tega oglasa ne moreš urejati"),
  - load error with retry,
  - Supabase not configured.
- The form is the creation form, prefilled, with the button "Shrani spremembe". Validation, field errors, focus, and the disabled saving state are shared with creation.
- Saving uses optimistic concurrency:
  - `update({...values, version: v + 1}).eq("id", id).eq("version", v)`.
  - If another edit changed the listing first, or it was deleted or hidden by RLS, no row comes back and the user sees "Oglas je bil medtem spremenjen ali odstranjen. Osveži stran in poskusi znova." Their input is kept.
  - On success the user returns to `/listings/[id]`.
- Other failures map to safe messages (permission, invalid data, offline, generic).

## Acceptance criteria

- [x] The owner can open their listing for editing from the detail page and see it prefilled like Android.
- [x] Non-owners, signed-out users, and missing listings get explicit states instead of a failing form.
- [x] Saving validates with the creation rules and updates only owner-editable columns (never `owner_id`, `id`, `is_filled`, `created_at`).
- [x] Concurrent edits do not silently overwrite each other (version check and bump) and show a recoverable conflict message.
- [x] Failures keep the input and show safe messages; success returns to the listing.
- [ ] Verified against real RLS in a browser (blocked: staging credentials and Playwright browsers).

## Implementation

- `lib/listings/listing-edit.ts` — `EDITABLE_COLUMNS`, `draftFromListing`, `loadListingForEdit` (ownership check after `auth.getUser()`), `updateListing` (version-guarded), `ListingConflictError`.
- `app/listings/[id]/edit/page.tsx`; `components/owner-listing-actions.tsx`, used in `app/listings/[id]/page.tsx` (the file was reformatted by Prettier).
- Shared with **Owner listing creation (PR #24)**: `lib/listings/listing-form.ts`, `components/listing-form.tsx`, and the `app/globals.css` form styles are byte-identical copies of that PR, so the two PRs merge cleanly in either order.
- The `listings.version` column already exists (default 1) but no trigger bumps it; the web client bumps it on edit. Android edits do not bump it, so a web edit racing an Android edit is not detected. A database trigger would close that gap (recorded for the RLS/migrations work).

## Testing contract

- Unit: prefill parity and round trip, owner/non-owner/missing/empty-id/signed-out loading, safe load errors, the update payload and version guard, forbidden columns, the conflict, DB and network error mapping.
- Integration: RLS denies updates by non-owners (staging).
- End-to-end: the owner edits and saves; a non-owner opening `/edit` sees the permission state; a stale form shows the conflict.
- Manual: none beyond the above.

## Handoff to testing

All unit scenarios above; component checks for the owner-only "Uredi oglas" link, the edit page states, and the conflict message.

## Test status

- Automated status: Partially covered
- Test files: `tests/listing-editing.test.ts` (creation-form tests live in PR #24)
- Scenarios covered: all unit scenarios (15 tests, passing with `npm run test`).
- Remaining gaps: page and link rendering are not component-tested (no React Testing Library/jsdom in the repo); no Playwright run (no installed browsers); RLS needs a staging project; Android edits do not bump `version`.
- Manual testing: Not run unless explicitly requested
