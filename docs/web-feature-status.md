# RoomieSlo web feature status

This document tracks feature scope, backlog, priority, and implementation status for the
Android-to-web migration. The technical execution requirements are consolidated in
[`web-implementation-plan.md`](./web-implementation-plan.md), which is maintained locally in
this web repository.

The source Android project provides the complete product behavior. The web application now
reads and writes the shared Supabase project for every feature; the preview data in
`lib/data.ts` is no longer used by any page. A feature is only considered complete when it is
implemented, covered by automated tests, and verified manually in a browser.

Last reviewed: 2026-10-14, against `main` after PRs #1–#77, and cross-checked with every record
in `docs/features/`. The notes name the PR that closed each gap. Updated 2026-10-16 for
cohabitation declarations and roommate ratings (`docs/features/cohabitation-declarations.md`,
`docs/features/roommate-ratings.md`).

## Status meanings

- **Backlog**: required work remains. `Partial` means only verification remains (a
  staging Supabase project, installed browsers, or a manual check); `Yes` means code or a
  decision is still missing.
- **Implemented**: the web surface and behavior exist on `main`.
- **Autotested**: automated coverage verifies the behavior. `Partial` means unit or static
  tests pass but the integration (staging) or Playwright (browser) suites written for it
  have not been executed yet.
- **Handtested**: the behavior has been exercised manually in a browser. The 2026-10-07
  checks were made against preview data; features rebuilt on Supabase since then are
  `No` until they are checked again.

The four state columns are independent.

## Current status summary

| Area                                     | Backlog | Implemented | Autotested | Handtested |
| ---------------------------------------- | :-----: | :---------: | :--------: | :--------: |
| Web foundation and responsive shell      | Partial |     Yes     |  Partial   |  Partial   |
| Authentication and academic verification | Partial |     Yes     |  Partial   |     No     |
| Profile and questionnaire                | Partial |     Yes     |  Partial   |     No     |
| Listings and search                      | Partial |     Yes     |  Partial   |  Partial   |
| Recommendations and matching             | Partial |     Yes     |  Partial   |     No     |
| Chat and realtime messaging              | Partial |     Yes     |  Partial   |     No     |
| Favorites                                | Partial |     Yes     |  Partial   |  Partial   |
| Reports and administration               | Partial |     Yes     |  Partial   |     No     |
| Offline/cache behavior                   | Partial |     Yes     |  Partial   |     No     |
| Production hardening                     |   Yes   |   Partial   |  Partial   |     No     |

What blocks most `Partial` rows is the same: no staging Supabase project (none of the
migrations has been applied, and the integration suite has never run), and no installed
browsers (the Playwright suite has never run). See "Automated verification" below.

## Feature checklist

### Phase 0 — product and backend preparation

| Feature                                               | Backlog | Implemented | Autotested | Handtested | Current web state / acceptance notes                                                                                                                                                                                           |
| ----------------------------------------------------- | :-----: | :---------: | :--------: | :--------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Shared Supabase data contract                         | Partial |     Yes     |  Partial   |     No     | Typed contract, mappers and query boundary are used by every page. Staging RLS/Storage/Realtime verification remains.                                                                                                          |
| Reproducible SQL migrations                           | Partial |     Yes     |  Partial   |     No     | Ordered, forward-only migrations in `supabase/migrations` (7 on `main`). Fresh-project apply and `db:status` need a staging project and the Supabase CLI.                                                                      |
| Development, staging, and production environments     |   Yes   |   Partial   |  Partial   |     No     | Deferred: Yes — owner decision (host, Supabase staging project). Environment validation (`npm run validate:env`, prebuild) is implemented. No staging or production environment exists yet; the host is an owner decision.     |
| RLS and Storage policy review                         | Partial |     Yes     |  Partial   |     No     | Chat/match gaps closed by `20261013000000` (#63); questionnaire answers owner-only by `20261015000000` (#77). Static security tests pass; none of the migrations is applied on staging yet.                                    |
| Account/document deletion and retention rules         | Partial |     Yes     |  Partial   |     No     | Implemented (#72–#76): tombstones and owner-only safety record, report evidence, audited admin view, self-service deletion Edge Function, daily retention job. Migrations not applied and functions not deployed (no staging). |
| Responsive breakpoints and accessibility requirements | Partial |     Yes     |  Partial   |    Yes     | Sidebar, bottom navigation, skip link, landmarks and focus styling. Viewport and keyboard Playwright specs are written but not run.                                                                                            |

### Phase 1 — web foundation

| Feature                                              | Backlog | Implemented | Autotested | Handtested | Current web state / acceptance notes                                                                                   |
| ---------------------------------------------------- | :-----: | :---------: | :--------: | :--------: | ---------------------------------------------------------------------------------------------------------------------- |
| Next.js TypeScript application                       |   No    |     Yes     |    Yes     |    Yes     | Typecheck, lint, unit tests and build run in CI (`quality.yml`).                                                       |
| Responsive desktop/tablet/mobile shell               | Partial |     Yes     |  Partial   |    Yes     | Viewport matrix specs (390/820/1440) exist; not executed (no browsers).                                                |
| Shared design tokens and navigation                  |   No    |     Yes     |    Yes     |    Yes     | Contrast-checked tokens (`tests/contrast.test.ts`).                                                                    |
| Authenticated and unauthenticated route guards       | Partial |     Yes     |  Partial   |     No     | Middleware plus client guard, open/public/auth route classes, safe return paths. Staging auth and browser runs remain. |
| Loading states                                       | Partial |     Yes     |  Partial   |     No     | Shared loading and data-state components are used by the data pages.                                                   |
| Empty, error, offline, and permission-denied states  | Partial |     Yes     |  Partial   |     No     | `DataState` surfaces on all data pages; browser offline runs remain.                                                   |
| TanStack Query server-state foundation               |   No    |     Yes     |  Partial   |     No     | Used by listings, favorites, matches, chat, profile and admin.                                                         |
| Linting, formatting, typecheck, and production build |   No    |     Yes     |    Yes     |    Yes     | All enforced in CI.                                                                                                    |
| CI pipeline                                          | Partial |     Yes     |  Partial   |     No     | `.github/workflows/quality.yml`; staging-gated e2e scenarios skip without secrets.                                     |

### Phase 2 — authentication and profile

| Feature                                     | Backlog | Implemented | Autotested | Handtested | Current web state / acceptance notes                                                                                                                            |
| ------------------------------------------- | :-----: | :---------: | :--------: | :--------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Email/password registration                 | Partial |     Yes     |  Partial   |     No     | `/register` with validation, `emailRedirectTo`, duplicate-account mapping. Staging Auth-trigger check remains.                                                  |
| Email/password login                        | Partial |     Yes     |  Partial   |     No     | `/login` with Slovenian errors and safe `returnTo`.                                                                                                             |
| Session restoration after refresh           | Partial |     Yes     |  Partial   |     No     | Single `AuthProvider`; a late `getSession` result can't overwrite newer auth events.                                                                            |
| Email confirmation flow                     | Partial |     Yes     |  Partial   |     No     | `/auth/confirm` and `/auth/confirmation` (open routes). The Supabase e-mail template needs staging.                                                             |
| Logout                                      | Partial |     Yes     |  Partial   |     No     | Local-scope sign-out that clears the query cache, favorites and storage.                                                                                        |
| Profile loading and editing                 | Partial |     Yes     |  Partial   |     No     | Own profile loads and saves; verification is protected by the #51 trigger.                                                                                      |
| Availability toggle                         | Partial |     Yes     |  Partial   |     No     | Saved to `profiles.is_available` with optimistic rollback (#65). Staging check remains.                                                                         |
| Verified-student indicator                  | Partial |     Yes     |  Partial   |     No     | The badge reads `academic_status_verified`. Only an admin or the database owner can set it; there is no in-app verification queue, and Android has none either. |
| Academic document upload                    | Partial |     Yes     |  Partial   |     No     | `/academic-verification` uploads to private `vpisnice/<uid>/`. Storage negative tests need staging.                                                             |
| Lifestyle questionnaire                     | Partial |     Yes     |  Partial   |     No     | `/profile/questionnaire` saves all statements; the profile card shows real progress (#65).                                                                      |
| Questionnaire conversion and skip semantics |   No    |     Yes     |    Yes     |     No     | Android parity tests pass.                                                                                                                                      |

### Phase 3 — listings and search

| Feature                               | Backlog | Implemented | Autotested | Handtested | Current web state / acceptance notes                                                                                                                                                                  |
| ------------------------------------- | :-----: | :---------: | :--------: | :--------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Listings feed                         | Partial |     Yes     |  Partial   |     No     | Supabase feed with offline fallback.                                                                                                                                                                  |
| Listing detail                        | Partial |     Yes     |  Partial   |     No     | Supabase detail with owner actions, request button and report link. `/listings/[id]` is at 195.5 of 200 kB; lazy-loading owner controls made it larger, so headroom must come from the shared bundle. |
| Owner listing creation                | Partial |     Yes     |  Partial   |     No     | `/listings/new`. RLS insert check needs staging.                                                                                                                                                      |
| Owner listing editing                 | Partial |     Yes     |  Partial   |     No     | Optimistic version check; every change bumps `listings.version` by trigger (#66), so Android edits are detected.                                                                                      |
| Owner listing deletion                | Partial |     Yes     |  Partial   |     No     | Confirmation; the favorites cascade needs staging.                                                                                                                                                    |
| Filled/available listing state        | Partial |     Yes     |  Partial   |     No     | Owner toggle; filled listings can't be requested.                                                                                                                                                     |
| Location filtering                    | Partial |     Yes     |  Partial   |  Partial   | Server-side `ilike` filter, kept in the URL. The earlier hand-check was against preview data.                                                                                                         |
| Price filtering                       | Partial |     Yes     |  Partial   |  Partial   | Server-side maximum price, kept in the URL.                                                                                                                                                           |
| Listing sorting                       | Partial |     Yes     |  Partial   |  Partial   | Client-side sort over the loaded pages.                                                                                                                                                               |
| Active filter chips and clear filters |   No    |     Yes     |  Partial   |    Yes     | Removable chips and "Počisti filtre".                                                                                                                                                                 |
| Slovenian result pluralization        |   No    |     Yes     |    Yes     |    Yes     | `oglas` / `oglasa` / `oglasi` / `oglasov` by the mod-100 rule (#69).                                                                                                                                  |
| Cursor/keyset pagination              | Partial |     Yes     |  Partial   |     No     | `(created_at desc, id desc)` cursor with a matching partial index (#66); real PostgREST `or` filter check on staging.                                                                                 |
| IndexedDB listing cache               | Partial |     Yes     |  Partial   |     No     | Per-user cache with 7-day expiry, written by `/listings` and `/search` (#67). Native IndexedDB untested (no browser run).                                                                             |
| Stale-cache and offline listing view  | Partial |     Yes     |  Partial   |     No     | Cached fallback with a stale notice on `/listings` and `/search`.                                                                                                                                     |
| Listing cards with real photos        | Partial |     Yes     |  Partial   |     No     | https-only photo URLs with fallback; photo upload is out of scope (Android has none).                                                                                                                 |
| Favorite listing action               | Partial |     Yes     |  Partial   |  Partial   | Supabase-backed with optimistic toggle.                                                                                                                                                               |
| Favorite mutations against Supabase   | Partial |     Yes     |  Partial   |     No     | RLS needs staging.                                                                                                                                                                                    |

### Phase 4 — recommendations and matching

| Feature                                       | Backlog | Implemented | Autotested | Handtested | Current web state / acceptance notes                                                                                                                                |
| --------------------------------------------- | :-----: | :---------: | :--------: | :--------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Compatibility-ranked recommendations          | Partial |     Yes     |  Partial   |     No     | Ranked in the `recommendations` Edge Function with the shared parity-tested code; answers stay private (#77). Deploy the function before applying `20261015000000`. |
| Compatibility calculation parity with Android |   No    |     Yes     |    Yes     |     No     | Parity tests pass.                                                                                                                                                  |
| Insufficient-answer empty state               | Partial |     Yes     |  Partial   |     No     | Shown below the minimum number of answers.                                                                                                                          |
| Match-request creation                        | Partial |     Yes     |  Partial   |     No     | Real request from the listing; filled listings refused.                                                                                                             |
| Pending/accepted/rejected request states      | Partial |     Yes     |  Partial   |     No     | Only the recipient can answer, in the UI and the database (#63).                                                                                                    |
| Match acceptance conflict handling            | Partial |     Yes     |  Partial   |     No     | Atomic `accept_match` RPC with conflict re-read.                                                                                                                    |
| Duplicate-request prevention                  | Partial |     Yes     |  Partial   |     No     | Unique pair index plus 23505 handling.                                                                                                                              |
| Open chat after successful match request      | Partial |     Yes     |  Partial   |     No     | Links into `/chats/[matchId]` once accepted.                                                                                                                        |

### Phase 5 — chat and realtime messaging

| Feature                                     | Backlog | Implemented | Autotested | Handtested | Current web state / acceptance notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------- | :-----: | :---------: | :--------: | :--------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chat list                                   | Partial |     Yes     |  Partial   |     No     | Real match list; accepted chats are marked delivered on load (#64).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Conversation route `/chats/[matchId]`       | Partial |     Yes     |  Partial   |     No     | Participant-only via RLS.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Message history                             | Partial |     Yes     |  Partial   |     No     | Ordered history with read marking.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Message composer                            | Partial |     Yes     |    Yes     |     No     | Enter/Shift+Enter and length limit; component tests (#68).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Immediate local message insertion           | Partial |     Yes     |  Partial   |     No     | Optimistic insert with retry.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Sent, delivered, and read states            | Partial |     Yes     |  Partial   |     No     | Read in the chat, delivered on the chat list (#64); only the recipient can advance the state, never backwards (#63).                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Supabase Realtime subscription              | Partial |     Yes     |  Partial   |     No     | Subscribes per conversation, cleaned up on unmount.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Reconnect with bounded backoff              | Partial |     Yes     |  Partial   |     No     | Bounded exponential backoff.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Message deduplication and rollback          | Partial |     Yes     |  Partial   |     No     | Client UUIDs for exact dedupe.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Report/block chat controls                  | Partial |     Yes     |  Partial   |     No     | Block/unblock plus a report link; `blocks` migration not applied anywhere.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Cohabitation declarations ("Živiva skupaj") | Partial |     Yes     |  Partial   |     No     | Declare, confirm ("Potrdi"/"Ne drži") and end in the chat; attention mark on `/chats`; "Moje sobivanje" on `/profile`. Participant-only RLS, writes through three RPCs, block hook, deletion and retention steps (`20261016000000`). Static, unit and component tests pass; migration not applied and integration suite not run (no staging).                                                                                                                                                                                                                                     |
| Roommate ratings                            | Partial |     Yes     |  Partial   |     No     | Double-blind ratings between confirmed cohabitants, shown only after the person opts in (off by default); profiles are 18+ (registration confirmation and an age constraint, `20261016000200`): chat reminder and form, summary on recommendation cards (not listings), "Ocene sostanovalcev" with improvements and the opt-out toggle on `/profile`, `/privacy` section, export v2 (`20261016000100`). Static, unit and component tests pass, and the SQL was executed in PGlite; not applied on staging, Edge Function not redeployed, contact e-mail and LIA sign-off pending. |

### Favorites, reporting, and administration

| Feature                      | Backlog | Implemented | Autotested | Handtested | Current web state / acceptance notes                                                                                  |
| ---------------------------- | :-----: | :---------: | :--------: | :--------: | --------------------------------------------------------------------------------------------------------------------- |
| Favorites empty state        |   No    |     Yes     |  Partial   |    Yes     | Links to search.                                                                                                      |
| Favorites saved-list view    | Partial |     Yes     |  Partial   |  Partial   | Supabase-backed list with photos.                                                                                     |
| Report user/listing          | Partial |     Yes     |  Partial   |     No     | `/report/[userId]` with Android reasons; no rate limit (same as Android).                                             |
| Admin report dashboard       | Partial |     Yes     |  Partial   |     No     | `/admin/reports` with status filters and changes. No admin view of reported conversations yet (deletion plan step 3). |
| Admin authorization boundary | Partial |     Yes     |  Partial   |     No     | `is_admin()`, status-only report updates, verification trigger; migration not applied anywhere.                       |

### Phase 6 — hardening and release

| Feature                                               | Backlog | Implemented | Autotested | Handtested | Current web state / acceptance notes                                                                                                                                            |
| ----------------------------------------------------- | :-----: | :---------: | :--------: | :--------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth, RLS, Storage, and Realtime integration tests    | Partial |     Yes     |  Partial   |     No     | `npm run test:integration` (25 tests, 28 with PR #63) has never run; it needs `SUPABASE_TEST_*`.                                                                                |
| Unit test suite                                       | Partial |     Yes     |    Yes     |     No     | `npm run test:coverage` (≥95% statements over `lib/` and `supabase/functions/_shared`), plus React Testing Library component tests (#68).                                       |
| Playwright end-to-end suite                           | Partial |     Yes     |  Partial   |     No     | 115 tests listed; never executed (no browsers; signed-in specs need `E2E_AUTH_STATE`).                                                                                          |
| Mobile, tablet, and desktop workflow coverage         | Partial |     Yes     |  Partial   |  Partial   | Viewport specs written, not executed.                                                                                                                                           |
| Keyboard navigation and focus coverage                | Partial |     Yes     |  Partial   |  Partial   | Static rules pass; keyboard journeys not executed.                                                                                                                              |
| Contrast and accessibility audit                      | Partial |     Yes     |  Partial   |     No     | Token contrast tests pass; axe scans not executed; no screen-reader pass.                                                                                                       |
| SEO and privacy protections                           | Partial |     Yes     |    Yes     |     No     | noindex policy and privacy headers; no CSP until a host is chosen.                                                                                                              |
| Performance and cross-browser checks                  | Partial |     Yes     |  Partial   |     No     | `npm run perf:budget` passes; the cross-browser matrix is not executed.                                                                                                         |
| Monitoring, backups, rollback, and deployment runbook |   Yes   |   Partial   |  Partial   |     No     | Deferred: Yes — owner decisions (host, alerting, backup locations). Runbook and `/api/health` exist; host, alerting and backup locations are owner decisions; no restore drill. |
| Account deletion and operational privacy procedures   | Partial |     Yes     |  Partial   |     No     | Self-service deletion on `/profile/delete-account` (#75); operator procedure, safety-record lookup, retention checks and restore re-application documented.                     |

## Automated verification

Available now and run in CI on every pull request:

```powershell
npm run typecheck
npm run lint
npm run format:check
npm test              # unit, static SQL and component tests
npm run build
npm run perf:budget
```

Written but never executed, because the environment is missing:

- `npm run test:integration`: needs a staging Supabase project with the migrations
  applied and `SUPABASE_TEST_*` set. It never accepts a service-role key.
- `npm run test:e2e`: needs Chromium (`npx playwright install chromium`); signed-in specs
  also need the authenticated staging project (`E2E_AUTH_STATE`). `E2E_BROWSERS` adds
  Firefox, WebKit and mobile devices.

## Hands-on verification completed

On 2026-10-07, against the preview-data prototype: saving and removing favorites, filter
and sort persistence in the URL, clearing filters, valid and unknown listing detail, and the
prototype match-request form. Those checks predate the Supabase-backed implementation and
have to be repeated against staging.

## Definition of done for the migration

The migration is complete only when:

1. The agreed Android feature set works on desktop, tablet, and mobile browsers.
2. Existing Supabase users and data remain usable without unsafe exposure.
3. Auth, RLS, Storage, match, report, and message negative-access tests pass.
4. Compatibility scores match the Android implementation.
5. Chat reconnects without duplicate messages and preserves delivery/read state.
6. Listing cache behavior is useful offline and never replaces valid data with an empty
   unauthenticated response.
7. Core workflows have unit, integration, and Playwright coverage.
8. Accessibility checks cover keyboard navigation, labels, focus, and contrast.
9. Deployment, monitoring, backups, account deletion, and rollback procedures are documented.
