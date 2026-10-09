# RoomieSlo web feature status

This document tracks feature scope, backlog, priority, and implementation status for the
Android-to-web migration. The technical execution requirements are consolidated in
[`web-implementation-plan.md`](./web-implementation-plan.md), which is maintained locally in
this web repository.

The source Android project currently provides the complete product behavior, while this web
repository is a responsive Next.js prototype using preview data from `lib/data.ts`. A feature
is only considered complete when it is implemented, covered by automated tests, and verified
manually in a browser.

## Status meanings

- **Backlog** — required work remains; the web implementation is missing or incomplete.
- **Implemented** — the web surface and behavior exist in the current repository.
- **Autotested** — automated unit, integration, or Playwright coverage verifies the behavior.
- **Handtested** — the behavior has been exercised manually in a browser at a supported
  viewport or workflow.

The four state columns are independent. For example, a prototype feature can be implemented
and handtested while still lacking automated coverage.

## Current status summary

| Area                                     | Backlog |         Implemented         | Autotested | Handtested |
| ---------------------------------------- | :-----: | :-------------------------: | :--------: | :--------: |
| Web foundation and responsive shell      | Partial |             Yes             |     No     |    Yes     |
| Authentication and academic verification |   Yes   |           Partial           |     No     |  Partial   |
| Profile and questionnaire                |   Yes   |           Partial           |     No     |  Partial   |
| Listings and search                      | Partial |           Partial           |     No     |    Yes     |
| Recommendations and matching             |   Yes   |           Partial           |     No     |    Yes     |
| Chat and realtime messaging              |   Yes   |           Partial           |     No     |     No     |
| Favorites                                |   No    | Yes (prototype persistence) |     No     |    Yes     |
| Reports and administration               |   Yes   |             No              |     No     |     No     |
| Offline/cache behavior                   |   Yes   |             No              |     No     |     No     |
| Production hardening                     |   Yes   |             No              |     No     |     No     |

## Feature checklist

### Phase 0 — product and backend preparation

| Feature                                               | Backlog | Implemented | Autotested | Handtested | Current web state / acceptance notes                                                                                                                                                                                                                                     |
| ----------------------------------------------------- | :-----: | :---------: | :--------: | :--------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Shared Supabase data contract                         |   Yes   |   Partial   |  Partial   |     No     | Deferred: Yes — typed contract, mappers, query boundary, listing-route integration, and `playwright.config.ts` are implemented; final completion is blocked on staging RLS/Storage/Realtime verification, Supabase CLI migration checks, and unavailable local Chromium. |
| Reproducible SQL migrations                           |   Yes   |   Partial   |     No     |     No     | Ordered production migrations, RLS/Storage/Realtime SQL, opt-in seed boundary, and recovery documentation now live in `supabase/`; fresh-project and security validation remain blocked on a disposable/staging project.                                                 |
| Development, staging, and production environments     |   Yes   |     No      |     No     |     No     | `.env.example` documents public browser configuration; environments are not established.                                                                                                                                                                                 |
| RLS and Storage policy review                         |   Yes   |     No      |     No     |     No     | Must include negative-access tests for profiles, listings, matches, messages, reports, and academic documents.                                                                                                                                                           |
| Account/document deletion and retention rules         |   Yes   |     No      |     No     |     No     | Must be documented before production use.                                                                                                                                                                                                                                |
| Responsive breakpoints and accessibility requirements |   No    |     Yes     |     No     |    Yes     | Desktop sidebar, mobile bottom navigation, skip link, semantic landmarks, and visible focus styling exist.                                                                                                                                                               |

### Phase 1 — web foundation

| Feature                                              | Backlog | Implemented | Autotested | Handtested | Current web state / acceptance notes                                                     |
| ---------------------------------------------------- | :-----: | :---------: | :--------: | :--------: | ---------------------------------------------------------------------------------------- |
| Next.js TypeScript application                       |   No    |     Yes     |     No     |    Yes     | App routes, TypeScript, and shared layout are present.                                   |
| Responsive desktop/tablet/mobile shell               | Partial |     Yes     |     No     |    Yes     | Responsive CSS exists; dedicated viewport automation is still missing.                   |
| Shared design tokens and navigation                  |   No    |     Yes     |     No     |    Yes     | Green/amber palette, cards, desktop navigation, and mobile navigation are implemented.   |
| Authenticated and unauthenticated route guards       |   Yes   |     No      |     No     |     No     | Login/register screens are present, but session-based protection is not wired.           |
| Loading states                                       | Partial |     Yes     |     No     |  Partial   | Shared route loading component exists; data-backed skeleton states are not connected.    |
| Empty, error, offline, and permission-denied states  | Partial |   Partial   |     No     |  Partial   | Not-found and route error foundations exist; offline and permission-denied flows remain. |
| TanStack Query server-state foundation               | Partial |     Yes     |     No     |     No     | Provider is configured, but current pages do not use it for Supabase data.               |
| Linting, formatting, typecheck, and production build |   No    |     Yes     |     No     |    Yes     | `typecheck` and `build` pass; feature-level test coverage is not yet present.            |
| CI pipeline                                          |   Yes   |     No      |     No     |     No     | The README lists quality commands, but no CI workflow is implemented.                    |

### Phase 2 — authentication and profile

| Feature                                     | Backlog |   Implemented   | Autotested | Handtested | Current web state / acceptance notes                                                                 |
| ------------------------------------------- | :-----: | :-------------: | :--------: | :--------: | ---------------------------------------------------------------------------------------------------- |
| Email/password registration                 |   Yes   |     Partial     |     No     |  Partial   | `/register` is a form-like prototype; it does not create an account or validate submission.          |
| Email/password login                        |   Yes   |     Partial     |     No     |  Partial   | `/login` is a form-like prototype with demo UI, not Supabase Auth.                                   |
| Session restoration after refresh           |   Yes   |       No        |     No     |     No     | No auth session is currently restored.                                                               |
| Email confirmation flow                     |   Yes   |       No        |     No     |     No     | Not implemented.                                                                                     |
| Logout                                      |   Yes   |     Partial     |     No     |     No     | Profile contains a logout-looking control, but it is not wired to Supabase Auth.                     |
| Profile loading and editing                 |   Yes   |     Partial     |     No     |  Partial   | Profile summary UI exists; persistence and edit flow are missing.                                    |
| Availability toggle                         | Partial | Yes (local UI)  |     No     |    Yes     | Toggle behavior is available locally; server persistence is still backlog.                           |
| Verified-student indicator                  | Partial | Yes (static UI) |     No     |    Yes     | Static “Preverjen študent” presentation exists; academic verification is not connected.              |
| Academic document upload                    |   Yes   |       No        |     No     |     No     | Browser file input, type/size validation, upload progress, and protected Storage access are missing. |
| Lifestyle questionnaire                     |   Yes   |       No        |     No     |     No     | Route and persistence for question IDs, values, weights, and skip behavior are missing.              |
| Questionnaire conversion and skip semantics |   Yes   |       No        |     No     |     No     | Requires porting Android behavior and unit tests.                                                    |

### Phase 3 — listings and search

| Feature                               | Backlog |         Implemented          | Autotested | Handtested | Current web state / acceptance notes                                                |
| ------------------------------------- | :-----: | :--------------------------: | :--------: | :--------: | ----------------------------------------------------------------------------------- |
| Listings feed                         | Partial |      Yes (preview data)      |     No     |    Yes     | `/listings` renders cards from `lib/data.ts`; Supabase feed is not connected.       |
| Listing detail                        | Partial |      Yes (preview data)      |     No     |    Yes     | `/listings/[id]` renders detail content and an invalid-ID recovery state.           |
| Owner listing creation                |   Yes   |              No              |     No     |     No     | `/listings/new` and its validation are missing.                                     |
| Owner listing editing                 |   Yes   |              No              |     No     |     No     | `/listings/[listingId]/edit` is missing.                                            |
| Owner listing deletion                |   Yes   |              No              |     No     |     No     | Not implemented.                                                                    |
| Filled/available listing state        |   Yes   |           Partial            |     No     |     No     | Availability copy is displayed, but owner state changes are missing.                |
| Location filtering                    | Partial |         Yes (local)          |     No     |    Yes     | Search filters preview listings and persists the location in the URL.               |
| Price filtering                       | Partial |         Yes (local)          |     No     |    Yes     | Budget slider filters preview listings and persists the maximum price in the URL.   |
| Listing sorting                       | Partial |         Yes (local)          |     No     |    Yes     | Relevance, newest, price ascending, and price descending are available.             |
| Active filter chips and clear filters |   No    |             Yes              |     No     |    Yes     | Removable chips and “Počisti filtre” are implemented.                               |
| Slovenian result pluralization        |   No    |             Yes              |     No     |    Yes     | Search displays `oglas`, `oglasi`, or `oglasov` according to result count.          |
| Cursor/keyset pagination              |   Yes   |              No              |     No     |     No     | Must be based on `created_at` when the Supabase feed is connected.                  |
| IndexedDB listing cache               |   Yes   |              No              |     No     |     No     | The migration plan requires caching listings only; no Dexie/IndexedDB layer exists. |
| Stale-cache and offline listing view  |   Yes   |              No              |     No     |     No     | Not implemented.                                                                    |
| Listing cards with real photos        |   Yes   |              No              |     No     |     No     | Cards currently use emoji preview illustrations.                                    |
| Favorite listing action               |   No    | Yes (localStorage prototype) |     No     |    Yes     | Shared favorite context connects cards, details, favorites, and reload persistence. |
| Favorite mutations against Supabase   |   Yes   |              No              |     No     |     No     | Local storage must be replaced or supplemented by authenticated Supabase mutations. |

### Phase 4 — recommendations and matching

| Feature                                       | Backlog |       Implemented        | Autotested | Handtested | Current web state / acceptance notes                                                              |
| --------------------------------------------- | :-----: | :----------------------: | :--------: | :--------: | ------------------------------------------------------------------------------------------------- |
| Compatibility-ranked recommendations          |   Yes   |         Partial          |     No     |     No     | Dashboard contains static recommendation preview data; no questionnaire-based calculation exists. |
| Compatibility calculation parity with Android |   Yes   |            No            |     No     |     No     | Must port and test equal, opposite, ignored, zero-weight, weighted, and normalized cases.         |
| Insufficient-answer empty state               |   Yes   |            No            |     No     |     No     | Not implemented.                                                                                  |
| Match-request creation                        | Partial | Yes (prototype feedback) |     No     |    Yes     | Detail page accepts an optional message and shows a success state locally.                        |
| Pending/accepted/rejected request states      |   Yes   |            No            |     No     |     No     | Supabase-backed state and conflict handling are missing.                                          |
| Match acceptance conflict handling            |   Yes   |            No            |     No     |     No     | Should be atomic through an RPC or constrained update.                                            |
| Duplicate-request prevention                  |   Yes   |            No            |     No     |     No     | Requires database constraint and client error handling.                                           |
| Open chat after successful match request      | Partial |         Partial          |     No     |    Yes     | Success state links to `/chats`, but no request-to-chat backend flow exists.                      |

### Phase 5 — chat and realtime messaging

| Feature                               | Backlog |    Implemented     | Autotested | Handtested | Current web state / acceptance notes                                                            |
| ------------------------------------- | :-----: | :----------------: | :--------: | :--------: | ----------------------------------------------------------------------------------------------- |
| Chat list                             | Partial | Yes (preview data) |     No     |  Partial   | `/chats` renders a static list; rows currently do not have a complete conversation destination. |
| Conversation route `/chats/[matchId]` |   Yes   |         No         |     No     |     No     | Route and listing context card are missing.                                                     |
| Message history                       |   Yes   |         No         |     No     |     No     | Not implemented.                                                                                |
| Message composer                      |   Yes   |         No         |     No     |     No     | Not implemented.                                                                                |
| Immediate local message insertion     |   Yes   |         No         |     No     |     No     | Not implemented.                                                                                |
| Sent, delivered, and read states      |   Yes   |         No         |     No     |     No     | Not implemented.                                                                                |
| Supabase Realtime subscription        |   Yes   |         No         |     No     |     No     | Requires reconnectable subscriptions and cleanup on unmount/hidden page.                        |
| Reconnect with bounded backoff        |   Yes   |         No         |     No     |     No     | Not implemented.                                                                                |
| Message deduplication and rollback    |   Yes   |         No         |     No     |     No     | Requires automated tests for reconnect and optimistic failure cases.                            |
| Report/block chat controls            |   Yes   |         No         |     No     |     No     | Not implemented.                                                                                |

### Favorites, reporting, and administration

| Feature                      | Backlog |         Implemented          | Autotested | Handtested | Current web state / acceptance notes                                           |
| ---------------------------- | :-----: | :--------------------------: | :--------: | :--------: | ------------------------------------------------------------------------------ |
| Favorites empty state        |   No    |             Yes              |     No     |    Yes     | Empty collection provides a direct link to search.                             |
| Favorites saved-list view    | Partial | Yes (localStorage prototype) |     No     |    Yes     | Saved listing appears after navigating from search and after reload.           |
| Report user/listing          |   Yes   |              No              |     No     |     No     | `/report/[userId]`, validation, and insert flow are missing.                   |
| Admin report dashboard       |   Yes   |              No              |     No     |     No     | `/admin/reports`, UI guard, status changes, and audit-safe errors are missing. |
| Admin authorization boundary |   Yes   |              No              |     No     |     No     | RLS must remain the security boundary even if the UI hides the route.          |

### Phase 6 — hardening and release

| Feature                                               | Backlog | Implemented | Autotested | Handtested | Current web state / acceptance notes                                                            |
| ----------------------------------------------------- | :-----: | :---------: | :--------: | :--------: | ----------------------------------------------------------------------------------------------- |
| Auth, RLS, Storage, and Realtime integration tests    |   Yes   |     No      |     No     |     No     | No web integration/security test suite exists.                                                  |
| Unit test suite                                       |   Yes   |     No      |     No     |     No     | No application-owned Vitest tests currently exist.                                              |
| Playwright end-to-end suite                           |   Yes   |     No      |     No     |     No     | No application-owned Playwright workflows currently exist.                                      |
| Mobile, tablet, and desktop workflow coverage         |   Yes   |   Partial   |     No     |    Yes     | Core prototype flows were checked in the shared browser; viewport matrix automation is missing. |
| Keyboard navigation and focus coverage                | Partial |   Partial   |     No     |  Partial   | Skip link and focus-visible styling exist; a complete keyboard journey test is missing.         |
| Contrast and accessibility audit                      |   Yes   |   Partial   |     No     |     No     | Basic accessible labels and focus styling exist; formal contrast/axe coverage is missing.       |
| SEO and privacy protections                           |   Yes   |     No      |     No     |     No     | Authenticated data indexing behavior and `noindex` policy are not configured.                   |
| Performance and cross-browser checks                  |   Yes   |     No      |     No     |     No     | Not implemented.                                                                                |
| Monitoring, backups, rollback, and deployment runbook |   Yes   |     No      |     No     |     No     | Not implemented or documented for the web deployment.                                           |
| Account deletion and operational privacy procedures   |   Yes   |     No      |     No     |     No     | Must be documented before production release.                                                   |

## Automated verification currently available

The web repository currently provides project-level checks:

```powershell
npm run typecheck
npm run build
```

Both checks pass for the current prototype. The package scripts also define `lint`,
`format:check`, and `test`, but feature-specific application tests and Playwright flows still
need to be added. The migration plan's required test cases are therefore recorded as backlog
until they have executable tests.

## Hands-on verification completed

The following prototype workflows have been exercised manually in the browser:

- Save a listing from search.
- Navigate to favorites and confirm the same listing appears.
- Reload and confirm the favorite remains.
- Remove the listing from favorites.
- Filter by location and confirm the result count updates.
- Persist search filters and sorting in the URL.
- Clear active search filters.
- Open a valid listing detail page.
- Open an unknown listing ID and recover through the listings link.
- Submit the match-request form and confirm the success state and chat link.

These checks validate the current preview-data behavior only. They do not replace authenticated,
Supabase-backed, multi-user, realtime, security, or offline testing.

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
