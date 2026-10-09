# Authenticated and unauthenticated route guards

- Status: Implemented
- Date: 2026-10-09
- Web surfaces: `middleware.ts`, `components/auth-provider.tsx`, `/login`, `/register`, `/admin/reports`
- Android behavior preserved: Existing Supabase session identity is used, logged-out users cannot enter application routes, authenticated users skip auth entry screens, and sign-out returns to authentication.

## Behavior

Middleware refreshes Supabase cookies and checks the current user before every application request. Public authentication entry points remain available without a session; all other routes, including future routes and `/admin/reports`, require a session. Unauthenticated destinations are encoded in `returnTo` with pathname and query state preserved. The centralized parser rejects external, protocol-relative, malformed, and unsafe values and falls back to `/listings`.

The client provider restores the browser session, subscribes to sign-in, sign-out, refresh, and expiry changes, and renders an explicit pending state before protected content or navigation. Login and registration call Supabase Auth rather than showing demo success. The admin page performs an `admins` table lookup subject to Supabase RLS and shows a permission-denied state for authenticated non-admins. The root metadata uses `noindex` for authenticated application content.

## Acceptance criteria

- [x] Protected and public routes have centralized classification and initial-request enforcement.
- [x] Internal return URLs preserve pathname and query state and reject unsafe destinations.
- [x] Authenticated users are redirected away from `/login` and `/register`.
- [x] Session restoration and auth state changes update access without a manual reload.
- [x] Pending auth state prevents protected-content flashes.
- [x] Configuration and session failures are shown as explicit errors.
- [x] Browser code uses only the two public Supabase environment variables.
- [x] Admin access has an RLS-backed `admins` lookup and denied state.
- [x] Authenticated content is marked `noindex`.
- [ ] Real Supabase staging, expiry, cross-tab, RLS-negative, and Playwright authenticated scenarios require disposable credentials and remain release-gated.

## Implementation

`lib/auth/routes.ts` owns route classification, normalization, login redirect construction, and safe return-path parsing. `middleware.ts` uses `@supabase/ssr` with the existing public browser configuration and propagates refreshed cookies. `components/auth-provider.tsx` owns browser session restoration and `onAuthStateChange`; `AppShell` is not rendered for public auth/error surfaces. Login and registration use the browser client for minimum Phase 1 session integration. `/admin/reports` checks the current user against `admins`; database RLS remains authoritative.

## Testing contract

- Unit: `tests/auth-routes.test.ts` covers route classes, dynamic/admin paths, safe URL handling, malformed/external rejection, and fallback behavior.
- Integration/security: staging-gated session refresh, expiry, sign-out, admin/non-admin, RLS denial, and browser-source credential checks. The existing browser-boundary test continues to enforce public-key-only configuration.
- End-to-end: staging-gated Playwright workflows for direct protected navigation, nested query return, auth-entry redirect, refresh, sign-out, invalid return, and admin permission states.
- Manual: Verify mobile, tablet, and desktop shell navigation with a real Supabase session.

## Handoff to testing

Run `npm run test`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`, and `npm run test:e2e`. With safe staging auth state, verify every currently implemented protected route, nested query preservation, refresh, sign-out, expired session, cross-tab propagation, admin/non-admin access, and backend-denied requests. Do not use or commit service-role credentials.

## Test status

- Automated status: Partially covered
- Test files: `tests/auth-routes.test.ts`, `tests/auth-guards-contract.test.ts`, `tests/supabase-boundary.test.ts`, `e2e/contract.smoke.spec.ts`
- Scenarios covered: Route classification including dynamic and admin paths; safe internal return URLs with pathname, query, hash, malformed, external, protocol-relative, backslash, and control-character rejection; centralized middleware enforcement and configuration/session error redirects; browser session restoration, auth-state subscription cleanup, pending-state protection, authenticated auth-entry redirects, sign-out navigation, and explicit auth errors; Supabase sign-in/sign-up wiring; RLS-backed admin lookup with denied/error states; noindex metadata; public-key-only browser configuration.
- Validation results: `npm run test` passed (5 files, 26 tests); `npm run typecheck` passed; `npm run lint` passed; `npm run build` passed. `npm run format:check` remains blocked by 31 pre-existing repository formatting violations; the changed test files are formatted. `npm run test:e2e` was attempted with the configured web server and then against a ready local server; the first attempt timed out waiting for the server, and the second was blocked because the Playwright Chromium executable is not installed. The available unauthenticated smoke tests therefore did not execute, while staging/authenticated tests remained skipped by their disposable-credential gate.
- Remaining gaps: Disposable Supabase staging coverage for session refresh, expiry, sign-out, cross-tab propagation, authenticated direct protected navigation, nested-query return, invalid return, admin/non-admin and RLS-denied states, backend-denied requests, and all authenticated Playwright workflows.
- Manual testing: Not run unless explicitly requested
