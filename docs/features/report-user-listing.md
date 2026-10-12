# Report user/listing

- Status: Partially implemented
- Date: 2026-10-11
- Web surfaces:
  - the `/report/[userId]` page (`app/report/[userId]/page.tsx`);
  - a "Prijavi oglas" link on `/listings/[id]`;
  - `lib/reports/report.ts`.
- Android behavior preserved: `ReportUserScreen` and `ReportViewModel` (`AdminRepository.reportUser`):
  - the same four reasons, with the same default ("Neprimerna vsebina");
  - an optional description;
  - "Pošiljam..." while sending;
  - an insert into `reports` with `reporter_id` = the current user;
  - "Neveljaven uporabnik." for a missing or invalid target;
  - "Prijava ni bila poslana." as the generic failure.

## Behavior

- `/report/<userId>` shows a radio group of reasons, an optional description (at most 1000 characters, with a counter), and "Pošlji prijavo".
- **Context:**
  - `?from=chat&match=<id>` (the link from the chat controls, PR #48) and `?from=listing&listing=<id>` (the new "Prijavi oglas" link) are recorded as a note at the end of the description, so admins see where the report came from;
  - with listing context the title reads "Prijavi oglas";
  - "Nazaj" returns to the chat or listing.
- **Validation before any request:** a malformed user id shows the invalid-user page, an unknown reason is refused, and an over-long description disables submit.
- **Server-side outcomes:**
  - signed out: a message and a login link;
  - reporting yourself: refused;
  - target no longer exists (`23503`): "Tega uporabnika ni več mogoče prijaviti.";
  - offline: a connection message;
  - anything else: "Prijava ni bila poslana."
- **Success:** a confirmation page ("Hvala. Prijava je poslana …") with "Nazaj". Android pops back instead; the web confirms explicitly so a double submission isn't possible. The form is also disabled while sending.
- Reporting a listing reports its owner. The `reports` table only references users; there is no listing column, which matches Android.

## Acceptance criteria

- [x] `/report/[userId]` exists with reason selection and an optional description.
- [x] Input is validated (target id, reason, description length) before inserting.
- [x] Insert as the current user, consistent with RLS `reports_insert` (`auth.uid() = reporter_id`).
- [x] Safe, Slovenian error states, with no raw database errors.
- [x] A report can be started from a listing and from a chat (the chat link comes from PR #48).
- [ ] Verified against a real Supabase project: insert allowed, and a non-admin cannot read reports (blocked: no staging credentials).
- [ ] No duplicate-report limit. RLS allows unlimited inserts, as on Android; rate limiting needs a database change.

## Implementation

- `lib/reports/report.ts`:
  - `REPORT_REASONS`, `validateReport`, `buildReport` (trims the description and adds the context note);
  - `submitReport` over a structural `ReportClient`, with `ReportError` kinds;
  - `parseReportContext`, `backHref`, `listingReportHref`.
- `app/report/[userId]/page.tsx` is a client page using `useMutation`, with `useSearchParams` inside `Suspense`.
- `app/listings/[id]/page.tsx` adds the "Prijavi oglas" link to `/report/<ownerId>?from=listing&listing=<id>`. Prettier also reformatted the file's early-return lines.
- `app/globals.css` adds the `report-*` classes.
- No migration: `reports` and its policies already exist in `20261007000001_security_and_storage.sql`.

## Testing contract

- Unit:
  - the reasons and default match Android;
  - context parsing, including mismatched parameters;
  - the listing and back links;
  - validation;
  - the built row (trimmed text plus the note);
  - `submitReport` inserts as the current user, validates without a request, and handles signed-out, self, `23503`, offline and RLS failures.
- Integration (staging):
  - an authenticated user inserts a report;
  - inserting with another `reporter_id` fails;
  - a non-admin `select` on `reports` returns nothing.
- End-to-end: open a listing, then "Prijavi oglas", submit, and see the confirmation.
- Manual: none beyond the above.

## Handoff to testing

Unit scenarios above; RLS checks and the browser flow once staging and browsers are available.

## Test status

- Automated status: Partially covered
- Test files: `tests/report.test.ts`
- Scenarios covered: all unit scenarios, 13 tests, passing with `npm run test`.
- Remaining gaps:
  - the page is not component-tested (no React Testing Library/jsdom);
  - no staging RLS or browser run.
- Manual testing: Not run unless explicitly requested
