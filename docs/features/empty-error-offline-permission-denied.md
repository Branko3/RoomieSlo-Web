# Empty, error, offline, and permission-denied states

- Status: Implemented
- Date: 2026-10-09
- Automated status: Implemented; staging and browser-gated scenarios remain unverified
- Web surfaces: `/listings`, `/search`, `/favorites`, `/listings/[id]`, route error boundaries, shared data-state components
- Android behavior preserved: loading, empty, failure, offline, authorization, and unknown-listing outcomes remain distinct; no browser cache was introduced.

## Scope

The shared typed state components provide loading, empty, recoverable error, offline, permission-denied, and authentication-required presentations. Connectivity is observed through the initial browser status and `online`/`offline` listeners. Query failures remain errors and existing data is retained while retrying or after a failed request.

## Implementation decisions

`components/data-states.tsx` classifies only known authentication/authorization responses and connectivity failures; it never displays backend error text. `lib/supabase/hooks.ts` exposes retry callbacks and preserves prior data on failure. Listings, search, favorites, and listing detail now use explicit state branches. Unknown listing IDs retain the existing navigable not-found presentation. Supabase RLS remains the authorization boundary.

## Acceptance criteria

- [x] Reusable typed state components and accessible recovery actions.
- [x] Empty, error, offline, permission-denied, and loading states are distinct.
- [x] Listings, search, favorites, and listing detail are wired without converting failures to empty data.
- [x] Route and global error boundaries retain retry and navigation actions.
- [x] Responsive/focusable state controls and Slovenian user-facing copy are provided.

## Testing contract

- Unit: state classification, listener lifecycle, accessible roles/names, retry callbacks, and query error preservation.
- Integration: mocked empty, failed, offline, denied, and unknown-listing outcomes for affected routes.
- End-to-end: desktop/mobile keyboard recovery and browser offline simulation.
- Manual: verify contrast and 200% zoom in staging.

## Automated validation

- `npm run lint` — pending local command result
- `npm run lint` — passed
- `npm run format:check` — blocked by pre-existing formatting drift in unrelated repository files; all changed files pass targeted Prettier checks
- `npm run typecheck` — blocked by stale pre-existing `.next/types` references to missing `/admin/reports` and `/auth-error` routes
- `npm run test` — passed (4 files, 19 tests)
- `npm run build` — passed, including production type validation
- `npm run test:e2e` — 2 browser tests failed because Chromium is not installed; 12 staging tests skipped because credentials are unavailable

## Known gaps

Disposable Supabase staging credentials, controlled RLS fixtures, and Playwright Chromium are not configured in this environment. IndexedDB listing caching and background synchronization remain explicitly deferred to Phase 3; profiles and matches are not treated as offline data.

## Handoff to testing

Exercise initial offline rendering and listener cleanup, reconnect retry, denied versus unauthenticated classification, no-results versus request failure, retention of valid data after offline failure, and keyboard access to every retry/navigation control.

## Test status

- Automated status: Partially covered
- Test files: `tests/data-states.test.ts`, `tests/state-surfaces.test.ts`, `tests/supabase-queries.test.ts`
- Scenarios covered: Known offline, permission-denied, authentication, and generic error classification; connectivity listener registration and cleanup; distinct accessible Slovenian loading, empty, offline, denied, authentication, and error markup with recovery controls; affected-route state wiring; unknown-listing navigation; and preservation of query failures rather than converting them to empty results.
- Remaining gaps: React hook-level initial `navigator.onLine` rendering, reconnect-triggered retry, retention of already-rendered data after a failed request, and desktop/mobile keyboard plus browser offline simulation remain unverified because the repository has no configured DOM test environment and Playwright Chromium is unavailable. Staging RLS/authorization fixtures and credentials are also unavailable.
- Manual testing: Not run unless explicitly requested
