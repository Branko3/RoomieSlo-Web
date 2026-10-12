# Admin report dashboard

- Status: Partially implemented
- Date: 2026-10-11
- Web surfaces: `/admin/reports` (`app/admin/reports/page.tsx`, with `app/admin/layout.tsx` setting `noindex`), `lib/admin/reports.ts`
- Android behavior preserved: `AdminDashboardScreen` and `AdminViewModel` (`AdminRepository`):
  - checks the `admins` row for the current user, then lists reports newest first;
  - shows "Nimaš administratorskih pravic." to non-admins and "Ni prijav." when there are none;
  - toggles a report open ↔ reviewed and updates only that row;
  - uses "Napaka pri nalaganju prijav." and "Statusa prijave ni bilo mogoče spremeniti." as errors;
  - never reads the reporter (`ReportDto` has no `reporter_id`).

## Behavior

- **The UI guard:**
  - signed-out users see a login prompt;
  - non-admins see "Nimaš administratorskih pravic." and no report data is requested;
  - the guard is only presentation, because RLS (`reports_admin_select` / `reports_admin_update`) is the real boundary.
- **The list:**
  - reports are shown newest first, up to 200 (the limit is stated on the page);
  - each shows the reason, the description (including the chat or listing note from "Report user/listing"), the date and the reported user's id;
  - status filters (Odprto, Rešeno, Zavrnjeno, Vse) show counts, and the default is "Odprto".
- **Status changes:**
  - "Označi kot rešeno" / "Ponovno odpri" are the Android toggle;
  - "Zavrni" sets an open report to `dismissed`, a status the schema allows but Android never sets;
  - only the changed row is updated in the cache, and the button is disabled while its request is pending.
- **Audit-safe errors:**
  - every failure maps to fixed Slovenian copy (offline, permission, load or update failure);
  - database messages, codes and ids are never displayed or logged;
  - an update that RLS silently skips (0 rows) is treated as a failure, not shown as success.
- `/admin/*` is marked `noindex, nofollow`.

## Acceptance criteria

- [x] `/admin/reports` lists reports for admins.
- [x] A UI guard handles non-admin and signed-out users.
- [x] Admins can change a report's status (open/reviewed/dismissed).
- [x] Errors are audit-safe.
- [ ] Verified against staging that non-admins get no rows and cannot update, and that admins can (blocked: staging credentials).
- [ ] No navigation entry. Android opens the dashboard from the profile for admins; the web profile page is still a prototype, so the route is reached by URL.

## Implementation

- `lib/admin/reports.ts`:
  - `isAdmin`, `listReports` (fixed `REPORT_COLUMNS` without `reporter_id`, `created_at desc`, limit 200), `setReportStatus` (`update … eq id … select`, where an empty result means not authorized);
  - `AdminError` kinds and the `adminCopy` text;
  - pure helpers `nextStatus`, `replaceStatus`, `filterReports`, `countByStatus`.
- `app/admin/reports/page.tsx` is a client page using TanStack Query (`["admin","reports"]`), with `useMutation` for status changes.
- `app/admin/layout.tsx` sets the `noindex` metadata for the admin area.
- `app/globals.css` adds the `admin-*` classes.
- No migration: the `admins` and `reports` policies already exist.

## Testing contract

- Unit:
  - the admin lookup is scoped to the current user, and a missing row means not admin;
  - signed-out and offline errors map correctly, and database messages are never exposed;
  - the list query shape excludes `reporter_id`, and null data counts as empty;
  - `42501` becomes not-admin;
  - an update returns the stored status, and 0 updated rows count as failure;
  - toggle, replace, filter and count helpers.
- Integration (staging):
  - a non-admin `select` returns `[]` and an `update` affects 0 rows;
  - an admin can read and update.
- End-to-end: an admin marks a report reviewed and reopens it; a non-admin sees the denial.
- Manual: none beyond the above.

## Handoff to testing

Unit scenarios above; RLS checks with an admin and a non-admin account on staging.

## Test status

- Automated status: Partially covered
- Test files: `tests/admin-reports.test.ts`
- Scenarios covered: all unit scenarios, 11 tests, passing with `npm run test`.
- Remaining gaps:
  - the page is not component-tested (no React Testing Library/jsdom);
  - no staging RLS or browser run.
- Manual testing: Not run unless explicitly requested
