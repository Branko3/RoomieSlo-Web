# Filled/available listing state

- Status: Implemented
- Date: 2026-10-11
- Web surfaces: `/listings/[id]` status chip, owner toggle, and match-request button; `components/listing-status-control.tsx`
- Android behavior preserved: `ListingRepository.markFilled`, `ListingDetailViewModel.toggleFilled` (optimistic update), and the detail screen. The chip reads "Zapolnjeno"/"Na voljo", the owner button reads "Označi kot zapolnjeno"/"Označi kot na voljo", and the match request is disabled while the listing is filled.

## Behavior

- Every viewer sees a status chip: "Na voljo" (green) or "Zapolnjeno" (grey), announced politely when it changes.
- The owner sees a toggle button under the chips; other users and signed-out visitors do not. This is UI only; RLS `listings_update` is the boundary.
- Toggling is optimistic, like Android: the chip and button flip immediately, the update `{ is_filled }` is sent with `id` and `owner_id = <verified user>` filters, and the UI settles on the value the database returns. On failure the previous state is restored and a safe alert is shown (gone or not owner, permission, offline, generic). The button is disabled while saving.
- While a listing is filled, "Pošlji zahtevo za ujemanje" is disabled, a hint explains why, and the submit handler refuses to send.
- The listings feed already shows only `is_filled = false` listings (existing query), so a filled listing drops out of the feed.

## Acceptance criteria

- [x] The listing state is visible to every viewer with the Android labels.
- [x] The owner can mark a listing filled or available from the detail page; only `is_filled` is updated, only on the verified owner's row.
- [x] The UI updates optimistically and rolls back on failure with a safe message.
- [x] An empty update result is reported instead of treated as success.
- [x] Match requests are not possible for filled listings.
- [ ] Verified against real RLS in a browser (blocked: staging credentials and Playwright browsers).

## Implementation

- `lib/listings/listing-status.ts`:
  - `listingStatusLabel`, `filledToggleLabel`, `canRequestMatch`,
  - `setListingFilled(client, id, filled)` (`update({is_filled}).eq("id").eq("owner_id").select("id,is_filled").maybeSingle()`),
  - `toggleFilledOptimistically(current, apply, persist)`.
- `components/listing-status-control.tsx` — owner check and toggle.
- `app/listings/[id]/page.tsx` — the chip, toggle, and request guard, plus a `filledOverride` state so the page reflects the confirmed value without refetching. The file was reformatted by Prettier; PRs #25 and #26 also edit it, so expect small merge conflicts there.
- `app/globals.css` — chip colors, control spacing, `.field-hint`, and `.error-message` (the same rules appear in other open PRs; keep one when merging).

## Testing contract

- Unit: labels, request guard, update payload and filters, confirmed value, empty result, signed-out and empty-id guards, error mapping without details, offline, optimistic apply/settle/rollback, persisted value.
- Integration: RLS denies status changes by non-owners (staging).
- End-to-end: the owner toggles and the chip and request button update; a non-owner sees no toggle; a filled listing leaves the feed.
- Manual: none beyond the above.

## Handoff to testing

All unit scenarios above; component checks for chip rendering, owner-only toggle visibility, the disabled request button and hint, and the rollback alert.

## Test status

- Automated status: Partially covered
- Test files: `tests/listing-status.test.ts`
- Scenarios covered: all unit scenarios (12 tests, passing with `npm run test`).
- Remaining gaps: chip, toggle, and request-button rendering are not component-tested (no React Testing Library/jsdom in the repo); no Playwright run (no installed browsers); RLS needs a staging project.
- Manual testing: Not run unless explicitly requested
