# Owner listing deletion

- Status: Implemented
- Date: 2026-10-11
- Web surfaces: "Izbriši oglas" on `/listings/[id]` (owner only), `components/delete-listing-button.tsx`
- Android behavior preserved: `ListingRepository.deleteListing` and the detail screen's AlertDialog ("Izbriši oglas?" / "Oglasa ne bo več mogoče obnoviti." / "Izbriši" / "Prekliči"); after deletion the user leaves the listing.

## Behavior

- The listing owner sees an "Izbriši oglas" link under the detail actions; other users and signed-out visitors never see it. This is UI only; RLS `listings_delete` (`auth.uid() = owner_id`) is the boundary.
- Clicking it opens an inline confirmation (`role="alertdialog"`) with the Android copy. Focus moves to "Prekliči", Escape cancels, and focus returns to the trigger on cancel.
- "Izbriši" disables both buttons and shows "Brisanje …".
- The request deletes with `id` and `owner_id = <verified user>` filters and asks for the deleted row back. On success the listing is removed from local favorites and the user is sent to `/listings` with `router.replace` (Back does not reopen the deleted listing). Favorites rows in the database go with it through the `on delete cascade` foreign key.
- If nothing was deleted (already removed, or not the owner), the user sees "Oglasa ni bilo mogoče izbrisati. Ne obstaja več ali nisi njegov lastnik." instead of a false success.
- Permission, offline, and generic failures show safe Slovenian messages and close the confirmation so the user can retry.

## Acceptance criteria

- [x] The owner can delete their listing from the detail page after an explicit confirmation matching Android.
- [x] Only the verified user's own listing is targeted; non-owners are never shown the action.
- [x] Success is confirmed by the returned row; an empty result is reported, not treated as success.
- [x] After deletion the user lands on `/listings` and the listing is removed from local favorites.
- [x] Failures show safe messages and allow retrying.
- [ ] Verified against real RLS and the favorites cascade in a browser (blocked: staging credentials and Playwright browsers).

## Implementation

- `lib/listings/listing-delete.ts` — `deleteListing(client, id)`: `auth.getUser()` → `delete().eq("id").eq("owner_id").select("id")`, with error kinds signed-out, gone, permission, offline, and unknown.
- `components/delete-listing-button.tsx` — owner check, confirmation panel, focus handling, favorites cleanup, navigation.
- `app/listings/[id]/page.tsx` renders the button at the end of the detail column (the file was reformatted by Prettier; PR #25 also edits this file, so expect a small merge conflict there).
- `app/globals.css` — confirmation, danger button, and `.error-message` styles (the same `.error-message` rule appears in other open PRs; keep one when merging).
- Matches and messages do not reference listings, so no other data is affected.

## Testing contract

- Unit: query shape with owner filter, owner from the verified user, empty or null result → gone, signed-out and empty-id guards before any request, permission/unknown mapping without details, offline, Slovenian copy.
- Integration: RLS denies deletion by non-owners; the favorites cascade removes favorite rows (staging).
- End-to-end: the owner deletes → lands on `/listings` and the listing is gone; cancel keeps it; a non-owner sees no delete action.
- Manual: none beyond the above.

## Handoff to testing

All unit scenarios above; component checks for owner-only visibility, the confirmation dialog (focus, Escape, cancel), the pending state, the error alert, and navigation on success.

## Test status

- Automated status: Partially covered
- Test files: `tests/listing-deletion.test.ts`
- Scenarios covered: all unit scenarios (9 tests, passing with `npm run test`).
- Remaining gaps: the button and confirmation interaction are not component-tested (no React Testing Library/jsdom in the repo); no Playwright run (no installed browsers); RLS and the cascade need a staging project.
- Manual testing: Not run unless explicitly requested
