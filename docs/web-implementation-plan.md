# RoomieSlo Web Implementation Plan

This document is the web repository's local implementation plan for the
Android-to-web migration. It consolidates the technical and product
requirements from the Android project's `web-migration-plan.md` so that agents
and developers can work from the web repository without depending on a
separate documentation checkout.

Use this document for architecture, compatibility constraints, delivery
phases, testing requirements, risks, and release criteria. Use
`docs/web-feature-status.md` as the source of truth for the current backlog,
feature priority, and implementation status.

## 1. Goal and scope

Build a responsive web application/PWA that works on desktop browsers,
tablets, and mobile browsers while preserving the existing RoomieSlo product
behavior, Supabase data model, authorization rules, and user workflows.

The migration replaces the Android client layer:

- Jetpack Compose screens become React components and Next.js routes.
- Navigation Compose becomes URL-based routing.
- ViewModels and `StateFlow` become TanStack Query plus local component/form
  state.
- The Supabase Kotlin SDK becomes the Supabase JavaScript SDK.
- Room listing cache becomes IndexedDB, preferably through Dexie.
- WorkManager synchronization becomes query invalidation, refresh-on-focus,
  and online-reconnect handling.
- Android file pickers become browser file input and drag-and-drop.
- Coroutine chat flows become Supabase Realtime subscriptions.
- Android lifecycle cleanup becomes React effect and route-unmount cleanup.

The first web release should cache listings only. Profiles and matches must
remain fresh and must not be treated as offline source-of-truth data.

## 2. Current product capabilities to preserve

The Android application currently provides:

- Email/password registration, login, session restoration, and logout.
- Academic-status verification through an enrollment-document upload.
- User profiles, availability status, and lifestyle-questionnaire answers.
- Room listings with creation, editing, deletion, filled/available status,
  details, filtering, and pagination.
- Compatibility-ranked roommate recommendations.
- Match requests with pending, accepted, and rejected states.
- Realtime chat with sent, delivered, and read message states.
- Favorite listings.
- User reports and an administrator report dashboard.
- Supabase Auth, PostgREST, Storage, and Realtime.
- Room listing caching and background synchronization on Android.

Existing Supabase users and data must remain usable without an account
migration.

## 3. Target architecture

### Required stack

- Next.js with TypeScript.
- React with responsive, accessible HTML controls.
- `@supabase/supabase-js` for browser access.
- TanStack Query for server state, caching, mutations, and invalidation.
- React Hook Form and Zod for forms and validation.
- IndexedDB through Dexie for the listing cache.
- Vitest for domain and component-level tests.
- Playwright for browser workflow tests.
- A managed Next.js host or another Node-compatible deployment platform.

The browser may use only the public Supabase URL and anon key. A service-role
key, private token, password, or academic document content must never be
shipped to the browser.

### Proposed web structure

```text
app/
  (auth)/
    login/
    register/
    academic-verification/
  (protected)/
    listings/
    listings/[listingId]/
    listings/new/
    listings/[listingId]/edit/
    search/
    recommendations/
    chats/
    chats/[matchId]/
    favorites/
    profile/
    profile/questionnaire/
    report/[userId]/
  admin/reports/
components/
features/
  auth/
  listings/
  profile/
  matching/
  chat/
  favorites/
  reports/
lib/
  supabase/
  queries/
  validation/
  compatibility/
  offline/
types/
tests/
```

Reuse existing project conventions where they differ from this proposed
structure.

## 4. Feature and route contract

| Capability | Web route/surface | Required behavior |
| --- | --- | --- |
| Login | `/login` | Restore Supabase session after refresh and show auth errors. |
| Registration | `/register` | Preserve display-name metadata and email confirmation. |
| Academic verification | `/academic-verification` | Validate browser files, show progress, and use protected Storage access. |
| Profile | `/profile` | Edit name, availability, verification state, and logout. |
| Questionnaire | `/profile/questionnaire` | Preserve question IDs, values, weights, save behavior, and skip semantics. |
| Listings feed | `/listings` | Responsive cards, loading/empty/error states, cursor pagination, and stale-cache messaging. |
| Listing detail | `/listings/[listingId]` | Owner actions, favorite state, filled state, and match request. |
| Create/edit listing | `/listings/new`, `/listings/[listingId]/edit` | Shared validation and form components. |
| Search | `/search` | Consistent location and price filtering with URL state where appropriate. |
| Recommendations | `/recommendations` | Client-side compatibility calculation and deterministic ordering initially. |
| Match requests | Listing/profile actions | Pending, accepted, rejected, and conflict states. |
| Chat list | `/chats` | Matched users, previews, unread state, and read state. |
| Chat | `/chats/[matchId]` | Reconnectable Realtime subscription with cleanup and deduplication. |
| Favorites | `/favorites` | Shared listing cards and favorite mutations. |
| Report user | `/report/[userId]` | Validate reason and description before insertion. |
| Admin reports | `/admin/reports` | UI guard plus server-enforced admin authorization through RLS. |

## 5. Backend and data contract

Reuse these existing backend resources where possible:

- Supabase Auth users and sessions.
- `profiles` and `questionnaire_answers`.
- `listings`, `favorites`, `matches`, and `messages`.
- `reports` and `admins`.
- The existing academic-document Storage bucket.
- Supabase Realtime publication for `messages`.
- Existing questionnaire IDs, compatibility data, and RLS policies.

Before production web development:

1. Move the current SQL baseline into numbered, reproducible migrations.
2. Establish development, staging, and production Supabase projects.
3. Review every RLS policy with allowed and denied-user tests.
4. Verify browser access for Auth, PostgREST, Storage, and Realtime.
5. Add or verify unique constraints preventing duplicate favorites and match
   requests.
6. Make match acceptance atomic through an RPC or constrained update.
7. Document account deletion, academic-document deletion, backups, and report
   retention.
8. Confirm academic documents are never exposed through public URLs.

RLS remains the authorization boundary. UI route guards improve user
experience but must never replace database authorization.

## 6. Concrete delivery phases

The feature list and current state for each phase are tracked in
`docs/web-feature-status.md`. Each completed feature must also have a
`docs/features/<feature-slug>.md` record.

### Phase 0 — product and backend preparation

Tasks:

- Confirm the web MVP and whether Android remains supported during transition.
- Freeze the shared data contract and identify schema changes.
- Create reproducible SQL migrations.
- Establish development, staging, and production environments.
- Review RLS, Storage policies, deletion, retention, and backup behavior.
- Define responsive breakpoints and accessibility requirements.

Exit criteria:

- A fresh staging Supabase project can be created from migrations.
- Security tests prove users cannot access another user's protected data or
  documents.
- The feature backlog and priorities are explicitly recorded in
  `docs/web-feature-status.md`.

### Phase 1 — web foundation

Tasks:

- Configure environment variables and Supabase browser clients.
- Complete the shared layout, responsive navigation, typography, design tokens,
  and error boundaries.
- Add authenticated and unauthenticated route guards.
- Add loading, empty, error, offline, and permission-denied states.
- Configure Vitest, Playwright, linting, formatting, type checking, builds,
  and CI.

Exit criteria:

- The app works at mobile, tablet, and desktop viewport sizes.
- Sessions survive refresh.
- Protected routes redirect correctly.
- Quality checks run reproducibly in CI.

### Phase 2 — authentication and profile

Tasks:

- Implement login, registration, email confirmation, session restoration, and
  logout.
- Implement profile loading and editing.
- Implement availability and verified-student state.
- Implement academic-document upload with type/size validation, progress, and
  protected Storage access.
- Implement the lifestyle questionnaire and save/skip semantics.
- Port the Kotlin compatibility calculation to a tested TypeScript utility.

Exit criteria:

- A user can create, verify, configure, sign in, sign out, and restore an
  account across refreshes and browsers.
- Protected documents are not exposed.
- Questionnaire and compatibility behavior matches Android behavior.

### Phase 3 — listings and search

Tasks:

- Connect the feed and detail pages to Supabase.
- Implement listing creation, editing, deletion, and filled/available actions.
- Implement location and price filters.
- Preserve keyset pagination based on `created_at`.
- Add IndexedDB listing caching and stale-data indication.
- Add favorites with optimistic updates and rollback on failure.
- Ensure keyboard, touch, narrow-screen, loading, empty, error, and offline
  behavior.

Exit criteria:

- Users can find, inspect, create, edit, favorite, and manage listings on
  mobile and desktop.
- A useful cached listing view is available offline.
- Offline or unauthenticated responses never overwrite valid cached data with
  an empty result.

### Phase 4 — recommendations and matching

Tasks:

- Implement compatibility-ranked recommendations.
- Show a clear score and an appropriate insufficient-answers empty state.
- Implement match-request creation.
- Implement accept/reject behavior with server conflict handling.
- Add reporting from profile or listing contexts.

Exit criteria:

- Recommendation ordering matches Android.
- Concurrent match actions do not display misleading success states.
- Reports are validated and authorized.

### Phase 5 — realtime chat

Tasks:

- Implement conversation list and message history.
- Insert sent messages immediately with safe optimistic state.
- Subscribe to Supabase Realtime for the active match.
- Reconnect with bounded exponential backoff.
- Deduplicate messages after reconnects and tab changes.
- Implement delivered/read transitions.
- Unsubscribe on route changes and when the page is hidden where appropriate.

Exit criteria:

- Two browser sessions can exchange messages reliably.
- Temporary network loss does not create duplicate messages.
- Delivery and read state remains correct after reconnect.

### Phase 6 — administration and hardening

Tasks:

- Implement the administrator report list and status changes.
- Add server-backed authorization and denied-access handling.
- Add audit-friendly error logging without passwords, tokens, or document
  contents.
- Add rate limiting or abuse controls where needed.
- Run performance, accessibility, responsive, and cross-browser checks.
- Prepare deployment, monitoring, backups, rollback, and account-deletion
  procedures.

Exit criteria:

- Supported workflows pass end-to-end tests.
- The application is deployable with documented operational procedures.

## 7. Testing contract

### Unit tests

Port and preserve compatibility tests:

- Equal answers produce the highest score.
- Opposite answers produce the lowest score.
- Questions answered by only one user are ignored.
- Non-explicit answers with weight zero are ignored.
- Higher-weight questions affect the result more strongly.
- Results are normalized regardless of answered-question count.

Also test:

- Questionnaire conversion and skip behavior.
- Listing validation and trimming.
- Price/date/optional-field conversion.
- Message deduplication.
- Optimistic mutation rollback.

### Integration and security tests

Cover:

- Authenticated and unauthenticated access.
- Owner-only listing mutations.
- User-only profile and questionnaire mutations.
- Match-participant-only match and message access.
- Admin-only report access.
- Academic-document Storage policies.
- Expired sessions and concurrent updates.

### Playwright workflows

Automate:

1. Registration and login.
2. Questionnaire completion and skipping.
3. Listing creation and editing.
4. Listing search and pagination.
5. Favorite and unfavorite.
6. Match-request sending and processing.
7. Two-context chat exchange.
8. Academic-document upload.
9. User report submission and admin processing.
10. Mobile, tablet, and desktop viewport behavior.

No feature is complete until its feature record identifies the relevant
automated tests, commands, results, and remaining gaps.

## 8. Risks and implementation decisions

### Offline behavior

The browser cannot reproduce WorkManager exactly, particularly when a tab is
closed. The first release provides cached listings and refresh-on-reconnect;
it does not promise full background synchronization.

### Session behavior

Use Supabase's recommended browser session behavior. Test refresh, multiple
tabs, expired sessions, and sign-out propagation.

### Realtime reliability

Treat subscriptions as reconnectable resources. Reconcile with the server
after reconnect because browsers can suspend tabs and mobile networks change.

### Compatibility calculation

Keep compatibility calculation in the client initially to preserve Android
results. Consider moving it behind a database function or server endpoint if
candidate counts grow or profile answers should not be broadly exposed.

### Mobile UX

Use touch-first layouts on small screens. Use persistent/wider navigation and
list/detail layouts on desktop rather than simply scaling the Android layout.

### SEO and privacy

Authenticated listings and profiles contain personal information. Do not
index protected user data by default; use suitable `noindex` behavior.

## 9. Definition of done

The migration is complete only when:

- The agreed feature set works on desktop, tablet, and mobile browsers.
- Existing Supabase users can log in without account migration.
- Existing listings, profiles, matches, favorites, reports, and messages remain
  available.
- RLS and Storage negative-access tests pass.
- Chat reconnects without duplicate messages.
- Listing cache behavior is useful offline and preserves valid cached data.
- Compatibility scores match Android.
- Core flows have unit, integration, and Playwright coverage.
- Accessibility checks cover keyboard navigation, labels, focus, and contrast.
- Deployment, monitoring, backups, deletion, and rollback procedures are
  documented.

## 10. Recommended first vertical slice

Implement one end-to-end slice before converting every screen:

1. Connect the web app to a staging Supabase project.
2. Implement login and session restoration.
3. Implement authenticated listing retrieval with server pagination.
4. Implement one responsive listing-detail page.
5. Add unit tests for data mapping and the compatibility utility.
6. Add a Playwright test from login to listing detail.

This validates Supabase integration, routing, authorization, responsive layout,
data access, and the testing setup before questionnaire, matching, offline, and
realtime work expands the surface area.
