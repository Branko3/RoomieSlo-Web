# Shared Supabase data contract

- Status: In progress (blocked on staging Supabase verification and local Playwright Chromium installation)
- Date: 2026-10-07
- Web surfaces: `/listings`, `/search`, `/listings/[id]`, `/favorites`; `lib/supabase`
- Android behavior preserved: Existing auth IDs, table names, nullable values, status checks, timestamps, ownership relationships, and protected `vpisnice` Storage semantics are retained.

## Behavior

Listing pages use the public browser Supabase client through typed query functions. PostgREST errors remain errors, loading and empty states are separate, and an unknown listing remains recoverable. Search filters are translated to `location`, `price_per_month`, and a future `created_at` cursor. Preview data is no longer imported by the in-scope listing routes.

## Acceptance criteria

- [x] Typed rows, insert/update shapes, status values, timestamps, and domain mappings cover Auth/session, profiles, questionnaire answers, listings, favorites, matches, messages, reports, and admins.
- [x] The contract is checked against `RoomieSlo-App/supabase/schema.sql`, migrations, policies, and `storage_policies.sql`.
- [x] Browser access uses only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- [x] Listing, profile, favorite, match, message, questionnaire, report, and Auth mapping/accessor foundations exist.
- [x] The four in-scope listing surfaces no longer use `lib/data.ts`.
- [x] Invalid rows throw explicit errors and query errors are not converted to empty success results.
- [x] Keyset pagination can use `created_at`; academic documents remain non-public Storage objects.
- [x] Playwright is scoped to `e2e/**/*.spec.ts`; Vitest is scoped to `tests/**/*.test.ts`.
- [x] Public and URL-state smoke tests are available with explicit staging skips.

## Implementation

`lib/supabase/types.ts` is the versioned TypeScript contract for the SQL schema. `mappers.ts` validates database rows and converts listings and form input without renaming Android columns. `queries.ts` is the reusable TanStack Query-compatible PostgREST boundary and uses the existing browser client. The schema includes the display-field additions from migrations `0002_polja_za_prikaz.sql`; `0003_demo_oglasi.sql` is development-only data and was not treated as a production contract.

The source SQL is available in the sibling Android project. No web-only database columns or migrations were added. The existing RLS policies remain authoritative: public authenticated listing/profile reads, owner-only listing mutations, user-owned favorites/questionnaire rows, match-participant messages, admin reports, and owner/admin academic-document access. Staging integration and negative-access execution require Supabase project credentials and remain deferred to the policy-review/migrations features.

## Testing contract

- Unit: `tests/supabase-mappers.test.ts` covers listing conversion, nullable availability, identifiers, timestamps, malformed rows, form inserts, and unauthenticated session mapping. The remaining table mapper tests should be extended with their downstream features.
- Integration/security: Deferred until a disposable or staging Supabase project is configured; required RLS, Storage, expired-session, and service-role scans are documented in the implementation plan.
- End-to-end: `playwright.config.ts` scopes browser discovery to `e2e/`, while `vitest.config.ts` scopes unit discovery to `tests/`. `e2e/contract.smoke.spec.ts` covers public configuration handling and URL-preserving search state locally, plus staging-gated listing/detail/not-found flows. On 2026-10-07, `npm run test:e2e` discovered 14 tests (12 intentional staging skips and 2 local smoke tests), but both local tests failed before execution because Chromium is not installed at the Playwright cache path. The required CDN installation could not be completed in this environment.
- Manual: Existing prototype browser checks do not count as Supabase verification; no staging manual verification was performed.

Validation completed on 2026-10-07: serialized `npm run build`, `npm run typecheck`, and `npm run lint` passed; `npm run test` passed with 16 tests in 3 files. The first parallel build/typecheck attempt was discarded because both processes raced on `.next`; the serialized rerun passed. `npm run test:e2e` discovered the configured suite but failed its two executable local tests before browser launch because Chromium is not installed. `npm run db:status` could not run because the Supabase CLI is not installed. No `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, or `E2E_AUTH_STATE` variables were present, so staging and authenticated checks were not attempted. The build renders `/listings` dynamically because browser Supabase configuration is runtime-only.

## Handoff to testing

Configure public staging variables and exercise authenticated/unauthenticated listing reads, URL-preserving location/price/sort filters, `created_at` cursor pagination, valid and unknown IDs, favorite mutation authorization, and backend-denied/offline states. Add negative-access tests for profiles, questionnaire answers, matches/messages, reports/admins, and `vpisnice` Storage; verify no browser bundle contains a service-role credential.

## Test status

- Automated status: Partially covered
- Test files: `tests/supabase-mappers.test.ts`, `tests/supabase-queries.test.ts`, `tests/supabase-boundary.test.ts`, `e2e/contract.smoke.spec.ts`
- Scenarios covered: Listing/profile/favorite/questionnaire/match/message/report row validation; listing form and unauthenticated session mapping; missing public configuration; empty listing IDs; location, price, `created_at` cursor, ordering, and limit query translation; blank optional filters; valid and unknown listing IDs; listing and profile backend/offline error propagation; malformed-row rejection; preview-data import guard; URL-preserving search state; public Supabase configuration; and service-role credential absence in browser source. `npm run test` passes with 20 tests in 3 files.
- Remaining gaps: Staging credentials and an operator-created safe auth state are not configured, so authenticated/unauthenticated RLS behavior, favorite mutation authorization, negative access for profiles/questionnaire/matches/messages/reports/admins, expired sessions, Realtime participant authorization, and protected `vpisnice` Storage access remain untested. The current web implementation has no Supabase favorite mutation or Storage query boundary to exercise; favorites remain client-provider state, while the other protected-table items are types/mappers only. Supabase migration/status verification is also pending because the Supabase CLI is unavailable. `npm run test:e2e` discovers 14 tests (12 intentional staging skips and 2 local smoke tests), but both local tests are blocked before browser launch until `npx playwright install chromium` succeeds in an environment with access to the Playwright CDN. The Playwright configuration is present and active; it is not a blocker.
- Manual testing: Not run unless explicitly requested
