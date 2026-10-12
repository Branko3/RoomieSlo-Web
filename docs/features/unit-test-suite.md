# Unit test suite

- Status: Partially implemented
- Date: 2026-10-11
- Web surfaces:
  - `vitest.config.ts` (coverage), and the `test:coverage` script with `@vitest/coverage-v8` in `package.json`;
  - new `lib/favorites.ts` and `lib/navigation.ts`, used by `components/providers.tsx` and `components/app-shell.tsx`;
  - new and extended tests in `tests/`.
- Android behavior preserved: no user-facing change. The favorites prototype keeps its `roomieslo:favorites` key and its add/remove order, and navigation shows the same items and highlights the same way.

## Behavior

- `npm run test` runs every application-owned unit test: 35 tests in 6 files on `main` plus this PR.
- `npm run test:coverage` runs them with V8 coverage over the application logic in `lib/`. It fails below 95% statements, lines and functions, or below 80% branches.
  - Today it reports 100% statements, lines and functions, and 88% branches.
  - Excluded: React hooks (`lib/supabase/hooks.ts`, which needs a DOM test environment), type declarations and preview data (`lib/data.ts`).
- **Logic moved out of components so it can be unit-tested:**
  - `lib/favorites.ts` contains `parseFavorites`, `serializeFavorites` and `toggleFavoriteId`.
    - One hardening change: saved data that is valid JSON but not a list of ids is now discarded, where before it was loaded as-is and could break `includes`.
    - Duplicate and empty ids are dropped.
  - `lib/navigation.ts` contains `NAV_ITEMS` and `activeSection`.
- The `coverage/` output is git-ignored.

## Acceptance criteria

- [x] Application-owned Vitest unit tests exist for configuration, the browser client boundary, mappers, queries, favorites and navigation.
- [x] A coverage command with enforced thresholds.
- [ ] Component and hook tests (needs a DOM environment such as jsdom and React Testing Library; not added here to keep dependencies minimal).
- [ ] Coverage enforced in CI (the CI pipeline is a separate PR; no workflow changes here).
- [ ] Unit tests from the open feature PRs (#17–#52) join this suite as they merge; they already follow the same conventions.

## Implementation

- `tests/favorites.test.ts` (8 tests): storage key compatibility, round-trip, cleaning, rejection of corrupt or wrongly shaped data, and toggle behavior and immutability.
- `tests/navigation.test.ts` (3 tests): active section from the path, root and null handling, and nav item order and labels.
- `tests/browser-client.test.ts` (3 tests): config with any missing variable is unconfigured; the client uses only the public URL and anon key; it fails clearly without config. `@supabase/ssr` is mocked.
- `tests/supabase-queries.test.ts` has 5 new tests:
  - default listing query and page size, and blank-location handling;
  - a zero price limit is kept;
  - an id is required before querying, and the detail query shape is checked;
  - `fetchProfiles` handles mapping, malformed rows and backend errors.
- **Conventions**, the same as the feature PRs:
  - Node environment, `tests/**/*.test.ts`;
  - Supabase mocked through structural clients or `vi.mock`, with no network;
  - user-facing copy asserted in Slovenian.

## Testing contract

- Unit: as listed above, with coverage thresholds enforced by `npm run test:coverage`.
- Integration: see the "Auth, RLS, Storage, and Realtime integration tests" PR (#52).
- End-to-end: the separate Playwright suite feature.
- Manual: none.

## Handoff to testing

Add `npm run test:coverage` to CI once the pipeline lands. Add jsdom and React Testing Library when component tests are taken on.

## Test status

- Automated status: Covered (unit level)
- Test files: `tests/favorites.test.ts`, `tests/navigation.test.ts`, `tests/browser-client.test.ts`, `tests/supabase-queries.test.ts`, plus the existing `tests/supabase-mappers.test.ts` and `tests/supabase-boundary.test.ts`
- Scenarios covered: 35 tests passing, and coverage thresholds met.
- Remaining gaps: no component or hook tests; not in CI.
- Manual testing: Not run unless explicitly requested
