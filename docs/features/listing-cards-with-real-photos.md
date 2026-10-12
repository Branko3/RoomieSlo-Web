# Listing cards with real photos

- Status: Implemented
- Date: 2026-10-11
- Web surfaces: listing cards (`components/listing-card.tsx`, used on `/listings` and `/search`), the `/listings/[id]` hero image, `/favorites` thumbnails, `components/listing-photo.tsx`
- Android behavior preserved: listings carry a `photo_url` string (`ListingDto.photoUrl`, default `""`) that the app displays when present; Android has no photo upload. The web reads the same column and shows the photo, or the existing preview art when there is none.

## Behavior

- Before this change the web printed `photo_url` as text inside the card art (the mapper falls back to the "🏠" emoji). Cards, the detail hero, and favorites thumbnails now render the photo as an image covering the art area (`object-fit: cover`).
- Only absolute `https:` URLs without embedded credentials are loaded. Empty, `http:`, `javascript:`, `data:`, protocol-relative, relative, malformed, and other-scheme values show the decorative placeholder, because `photo_url` is free text written by owners.
- Images load lazily, except the detail hero, which is the page's main image (`priority`). They are served as-is (`unoptimized`), so no image domains need configuration, and they are requested with `referrerPolicy="no-referrer"`.
- If a photo fails to load (404, blocked host), the placeholder replaces it without a broken-image icon.
- Each photo has alt text "Fotografija oglasa: <title>, <district>"; the placeholder is `aria-hidden`. Layout sizes stay the same, so cards keep their height whether or not a photo exists.

## Acceptance criteria

- [x] Cards, the detail page, and favorites show the listing's photo when `photo_url` holds a safe https URL.
- [x] Listings without a usable photo show the existing placeholder instead of raw text.
- [x] Unsafe URL schemes are never loaded.
- [x] Broken images fall back to the placeholder.
- [x] Photos have descriptive alt text and do not change the card layout.
- [ ] Photo upload for owners (not in Android; needs a public listing-photos Storage bucket and policies, which do not exist yet).
- [ ] Verified rendering in a browser at all viewports (blocked: no installed browsers).

## Implementation

- `lib/listings/listing-photo.ts` — `safePhotoUrl`, `photoAlt`, `PHOTO_PLACEHOLDER`.
- `components/listing-photo.tsx` — `next/image` with `fill`, `sizes`, `unoptimized`, error fallback state.
- `components/listing-card.tsx`, `app/listings/[id]/page.tsx`, and `app/favorites/page.tsx` use it (the latter two were reformatted by Prettier; other open PRs edit the detail page too, so expect small merge conflicts there).
- `app/globals.css` — `overflow: hidden` and a positioning context for the art containers, `object-fit: cover`, and the heart button above the photo.
- The `Listing.image` mapper field is unchanged (photo URL or emoji), so existing code and tests keep working.

## Testing contract

- Unit: accepted https URLs and normalization; rejection of empty, null, emoji, http, javascript, data, protocol-relative, relative, malformed, credential, and ftp values; alt text with and without the district; mapper-to-photo flow for safe, empty, and unsafe values.
- Integration: none required.
- End-to-end: a listing with a photo renders an `img` with alt text; without a photo the placeholder shows; a 404 photo falls back.
- Manual: visual check of cropping at mobile, tablet, and desktop widths.

## Handoff to testing

All unit scenarios above; component and browser checks for the image element, the placeholder, and the error fallback.

## Test status

- Automated status: Partially covered
- Test files: `tests/listing-photo.test.ts`
- Scenarios covered: all unit scenarios (21 tests, passing with `npm run test`).
- Remaining gaps: the component's image/placeholder/error-fallback rendering is not component-tested (no React Testing Library/jsdom in the repo); no browser run (no installed browsers); photo upload is out of scope.
- Manual testing: Not run unless explicitly requested
