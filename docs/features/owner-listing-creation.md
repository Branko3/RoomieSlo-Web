# Owner listing creation

- Status: Implemented
- Date: 2026-10-11
- Web surfaces: `/listings/new`, `components/listing-form.tsx`, "+ Objavi oglas" on `/listings`
- Android behavior preserved: `CreateListingViewModel.save`, `PodatkiOglasa.ocisceni`, and `ListingRepository.createListing`. The web form keeps the same fields, the required location and price, digits-only numeric inputs, trimmed text, empty optional numbers meaning "no data", flatmates defaulting to 0, the `YYYY-MM-DD` move-in date (empty = "po dogovoru"), the same room-type and Ljubljana district lists, and an insert with `owner_id` = the current user.

## Behavior

- `/listings/new` shows a form in two groups: basic data (title, location*, district, room type, description with a counter) and price and details (price*, deposit, size, flatmates, move-in date, bills included, furnished).
- Numeric inputs strip non-digits as the user types (Android parity).
- Submitting validates in the browser:
  - location and price are required,
  - price is a whole number of euros from 0 to 100 000 (Android allows 0),
  - deposit is at most 100 000, size at most 1000 m², flatmates at most 20,
  - title and location are at most 120 characters, description at most 2000,
  - room type and district must come from the Android lists,
  - the move-in date must be a real calendar date.
- Errors are shown per field with `aria-invalid`/`aria-describedby`, and the first invalid field is focused.
- While saving the form is disabled and the button reads "Shranjevanje …". On success the user is taken to the new listing at `/listings/{id}`. On failure a safe alert appears and the input is kept: signed out, permission (RLS), invalid data (22xxx/23xxx), offline, or generic. Database messages are never shown.
- Without Supabase configuration the page shows that publishing is unavailable.

## Acceptance criteria

- [x] An authenticated owner can create a listing with the Android fields from `/listings/new`.
- [x] Location and price are required; optional fields are trimmed and converted with Android's defaults.
- [x] Browser validation covers numbers, limits, option lists, and real dates before any request.
- [x] The insert sets `owner_id` from the verified user and never sends id, `is_filled`, or `created_at`.
- [x] Success navigates to the new listing; failures keep the input and show safe messages.
- [x] `/listings` links to the creation page.
- [ ] Verified against real RLS (`owner_id = auth.uid()`) in a browser (blocked: staging credentials and Playwright browsers).
- [ ] Listing photos (separate feature "Listing cards with real photos").

## Implementation

- `lib/listings/listing-form.ts`:
  - `ROOM_TYPES`, `DISTRICTS`, `LISTING_LIMITS`, `ListingDraft`/`emptyListingDraft`,
  - `validateListingDraft` (draft → `ListingValues`), `digitsOnly`, and `isValidIsoDate`,
  - `createListing(client, values)` (`auth.getUser` → `insert({...values, owner_id}).select("id").single()`) and error mapping.
  - The draft, validation, and form are reusable by "Owner listing editing".
- `components/listing-form.tsx` — the accessible form component (`onSubmit` returns an error message or `null`).
- `app/listings/new/page.tsx`; `app/listings/page.tsx` gains the "+ Objavi oglas" link (the file was reformatted by Prettier).
- `app/globals.css` — form, row, and field styles plus `.error-message` (the same rule appears in PRs #18–#22; keep one when merging).
- The extra limits (max price, lengths, real dates) are web-side guards; the database has no matching check constraints.

## Testing contract

- Unit: option lists, required fields, defaults, trimming and conversion, every invalid field, upper limits, date message, digit filtering, calendar dates, insert payload and owner, forbidden fields, signed-out guard, error mapping without leaking details, offline, missing id.
- Integration: RLS denies inserts with a different `owner_id` (staging).
- End-to-end: fill the form, publish, land on the new listing; invalid submit focuses the first error.
- Manual: none beyond the above.

## Handoff to testing

All unit scenarios above; component checks for focus on the first invalid field, the disabled state while saving, the error alert, and navigation on success.

## Test status

- Automated status: Partially covered
- Test files: `tests/listing-creation.test.ts`
- Scenarios covered: all unit scenarios (33 tests, passing with `npm run test`).
- Remaining gaps: form rendering and interaction are not component-tested (no React Testing Library/jsdom in the repo); no Playwright run (no installed browsers); RLS needs a staging project; photos are out of scope.
- Manual testing: Not run unless explicitly requested
