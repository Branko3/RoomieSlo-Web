# Account deletion and operational privacy procedures

- Status: Partially implemented
- Date: 2026-10-12
- Web surfaces:
  - `/privacy` (`app/privacy/page.tsx`);
  - `lib/privacy/export.ts`;
  - `docs/operations/privacy-procedures.md`;
  - the `NEXT_PUBLIC_PRIVACY_CONTACT` entry in `.env.example`.
- Android behavior preserved: Android has no account deletion or data export. Operator deletion through the Supabase dashboard works for accounts created on either client. Nothing changes in the schema.

## Behavior

- **`/privacy` ("Tvoji podatki"):**
  - explains which data is stored;
  - "Prenesi podatke" downloads a JSON export of everything the signed-in user can read about themselves: profile, questionnaire answers, own listings, favorites, sent messages, filed reports, matches, and the names of their academic documents. All reads are filtered to `auth.uid()` and limited by RLS. Failures show safe copy, and a partial export is never produced.
  - "Zahtevaj izbris" and "Zahtevaj popravek" open a pre-filled email to `NEXT_PUBLIC_PRIVACY_CONTACT`. If the contact is not set, the page says so.
- **Operator procedures (`docs/operations/privacy-procedures.md`):**
  - GDPR request types and deadlines, and a request log;
  - identity verification;
  - the manual account-deletion procedure:
    1. check open reports;
    2. delete the `vpisnice/<uid>/` documents first, because database deletion doesn't remove Storage files;
    3. delete the Auth user, with today's cascade effects spelled out;
    4. run the verification SQL;
    5. handle backups, then reply to the user.
  - data minimisation rules and the breach response (72-hour notification to the Informacijski pooblaščenec);
  - a quarterly retention review with an orphaned-document query.
- **No automatic deletion was built.** PR #9 blocks self-service deletion until the retention matrix (messages, reports, listings, logs) is approved, and today's cascades would delete the other participant's messages and safety reports. The procedure documents that and defers to PR #9.

## Acceptance criteria

- [x] Account deletion and privacy procedures are documented before production release.
- [x] Users can get a copy of their data (access and portability) and request deletion or correction from the app.
- [x] Deletion explicitly covers Storage documents and backups, and verifies the result.
- [ ] Self-service account deletion (blocked: PR #9 retention matrix approval, plus a trusted server operation).
- [ ] Owner decisions: privacy contact, request log and breach register locations, backup retention.
- [ ] The export run against a real project (blocked: no staging credentials).

## Implementation

- `lib/privacy/export.ts`:
  - `OWNED_TABLES`, `exportMyData` (structural `ExportClient`, injectable clock), `ExportError` and its copy;
  - `exportFileName`, which includes only the first 8 characters of the id;
  - `privacyRequestHref`.
- `app/privacy/page.tsx` is a client page using `useMutation`; the download uses a Blob URL that is revoked straight away.
- `app/globals.css` adds the `privacy-*` classes.

## Testing contract

- Unit (`tests/privacy.test.ts`, 10 tests):
  - every owned table is queried by its owner column for the signed-in user, along with matches by either participant and the user's own Storage folder;
  - the table list is complete;
  - null data counts as empty;
  - signed-out makes no queries;
  - offline and failed errors produce no partial export;
  - the file name and mailto encoding;
  - the procedures document's sections, the deletion step order (Storage before Auth before verification), the 72-hour rule and the PR #9 reference.
- Integration: run the export on staging with a seeded account and compare it to the tables.
- Manual: a deletion drill on staging following the procedure.

## Handoff to testing

On staging, export a seeded account and check every table is present. Then run the deletion procedure on a test account and confirm the verification query returns zeros.

## Test status

- Automated status: Partially covered
- Test files: `tests/privacy.test.ts`
- Scenarios covered: all unit scenarios (10 tests, passing with `npm run test`). `npm run build` includes `/privacy`.
- Remaining gaps: no staging run; no self-service deletion; the page is not component-tested.
- Manual testing: Not run unless explicitly requested
