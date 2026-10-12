# Academic document upload

- Status: Implemented
- Date: 2026-10-11
- Web surfaces: `/academic-verification`, `components/academic-document-upload.tsx`
- Android behavior preserved: `AuthRepository.uploadAcademicProof` uploads the enrollment confirmation (vpisnica) to the private `vpisnice` bucket at `{uid}/vpisnica.{pdf|png|jpg}` with `upsert = true`; PDF, PNG, and JPEG are accepted; an administrator verifies the status later. The page copy, "Pošlji v preverjanje", and "Preskoči za zdaj" match `AcademicVerificationScreen`.

## Behavior

- `/academic-verification` (not indexed) explains the purpose and shows the upload card.
- States: loading; Supabase not configured or session lookup failed (safe "not available" message); signed out (link to `/login`); ready.
- When the user already has a `vpisnica.*` object in their folder, the card says it is waiting for review and that a new file replaces it.
- File selection is validated in the browser before any request:
  - type: PDF, PNG, or JPEG by MIME type, falling back to the extension when the browser reports none,
  - the extension must not contradict the MIME type,
  - the file must not be empty,
  - the maximum size is 10 MB.
  - Errors are announced and linked to the input with `aria-describedby`.
- The upload goes directly to the Storage REST endpoint `POST /storage/v1/object/vpisnice/{uid}/vpisnica.{ext}`:
  - It sends the user's own access token, the public anon key, the content type, and `x-upsert: true`.
  - A `progressbar` shows the percentage. It stops at 99 % until the server confirms, then reaches 100 %.
  - The user can cancel while it runs.
- Success shows "Naloženo: <ime> ✓ Potrdilo čaka na preverjanje skrbnika." and "Nadaljuj" to `/profile`. Failures show safe messages: re-login (401/403), too large (413), offline (network/status 0), cancelled, or generic. The user can retry.
- The document is never shown, downloaded, or exposed through a public URL; the client only lists the user's own folder for the file name.

## Acceptance criteria

- [x] Signed-in users can upload a PDF, JPG, or PNG enrollment document to `vpisnice/{uid}/vpisnica.{ext}` with upsert, matching Android.
- [x] Browser-side type, extension, empty-file, and 10 MB size validation runs before upload.
- [x] Upload progress is shown and the upload can be cancelled.
- [x] Permission, size, network, cancel, and generic failures show safe Slovenian messages with retry.
- [x] Protected Storage access only: user token + anon key, private bucket, no public URL, no document content rendered.
- [x] An existing upload is detected and shown as pending review.
- [ ] Storage RLS verified against a real project (blocked: staging credentials).
- [ ] Verified-student indicator updated after admin review (separate feature; admin flow not implemented).

## Implementation

- `lib/academic/document-upload.ts`:
  - `validateDocument`, `documentPath` (rejects ids that are not UUID-like so the owner folder cannot be escaped), and `storageObjectUrl`,
  - `uploadDocument`, which is XHR-based with progress and abort and takes an injectable request factory for tests,
  - `findExistingDocument`, plus error kinds and messages.
- XHR is used instead of `supabase.storage.upload` because supabase-js does not report upload progress.
- `components/academic-document-upload.tsx` — page state machine; reads the session with `auth.getSession()` (Storage validates the token server-side).
- `app/academic-verification/page.tsx` — route with `robots: noindex`.
- `app/globals.css` — upload card, picker, hint, and `.error-message` styles (the same `.error-message` rule appears in PRs #18–#20; keep one when merging).
- Known parity behavior: uploading a different type (e.g. PNG after PDF) leaves the earlier object in place, exactly like Android. Cleanup belongs to "Account/document deletion and retention rules" (PR #9).
- No route links here yet from registration or profile; the flow entry point will be wired with registration (PR #15) or the verified-student indicator.

## Testing contract

- Unit: validation (types, extension fallback/mismatch, empty, 10 MB boundary), size formatting, path and URL construction, request headers and body, progress capping, HTTP/network/abort error mapping, token never in the URL, existing-document lookup and errors.
- Integration: Storage RLS — a user can upload/list only in their own folder; another user's folder is denied; admins can read (staging).
- End-to-end: choose an invalid file → error; valid file → progress → success; reload shows pending review.
- Manual: none beyond the above.

## Handoff to testing

- Accept `application/pdf`, `image/png`, `image/jpeg`, and an extension-only `.jpg`; reject docx, gif, svg, and no-extension files; reject a `.pdf` declared as `image/png`; reject 0 bytes; accept exactly 10 MB, reject 10 MB + 1.
- `documentPath` builds `{uid}/vpisnica.{ext}` and rejects `../other` and empty ids.
- `uploadDocument`: POST to the non-public object URL with `Authorization`, `apikey`, `Content-Type`, `x-upsert`, `cache-control`; progress 25 → 99 → 100 only on success; 401/403/413/500/network/abort mapping.
- `findExistingDocument`: lists `vpisnice` with the user id folder; finds `vpisnica.pdf`; null when empty; safe error on failure.
- Component: signed-out, unavailable, existing upload notice, selection error, progress bar values, cancel, retry, success copy.

## Test status

- Automated status: Partially covered
- Test files: `tests/academic-document-upload.test.ts`
- Scenarios covered: all logic scenarios above (28 tests, passing with `npm run test`).
- Remaining gaps: component states and interactions are not component-tested (no React Testing Library/jsdom in the repo); no Playwright run (no installed browsers); Storage RLS negative-access tests need a staging project.
- Manual testing: Not run unless explicitly requested
