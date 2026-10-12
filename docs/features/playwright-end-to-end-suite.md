# Playwright end-to-end suite

- Status: Partially implemented
- Date: 2026-10-11
- Web surfaces: the specs in `e2e/` (new: `env.ts`, `navigation.spec.ts`, `auth-pages.spec.ts`, `search.spec.ts`, `favorites.spec.ts`, `listing-detail.spec.ts`) and the `test:e2e:list` script. No application code changes.
- Android behavior preserved: not applicable. The workflows covered are the web's own (navigation, auth pages, search, favorites, listing detail).

## Behavior

- `npm run test:e2e` runs 32 workflow tests: 17 new ones plus the existing `contract.smoke.spec.ts`. They use the existing `playwright.config.ts` (a dev server on a per-worktree port, or `E2E_BASE_URL`; `unauthenticated` and optional `authenticated` projects).
- **Workflows that run with no backend:**
  - Navigation: each sidebar link opens its page, shows its heading and is marked active; the mobile navigation works on a phone viewport; the skip link takes focus first and jumps to `#main-content`; unknown routes return 404 with a "Na oglase" way back.
  - Auth pages: login has the right field types and links to registration and back.
  - Search: filters are written to the URL and restored on reload; a filter chip can be removed; "Počisti filtre" resets the URL and sort; the result count is announced with `aria-live`.
  - Favorites: without Supabase, an explanatory alert; corrupt saved favorites are discarded and reset to `[]`.
- **Workflows that need staging data:** they skip themselves without `NEXT_PUBLIC_SUPABASE_*`, `E2E_LISTING_ID` or the `authenticated` project (`E2E_AUTH_STATE`).
  - Favorites: the empty collection links to search; a listing saved from its detail page appears in favorites after reload and can be removed.
  - Listing detail: the match request shows a confirmation and links to chats; "Nazaj na oglase" goes back.
- `npm run test:e2e:list` lists every test without a browser or server (useful in CI without browsers).

## Acceptance criteria

- [x] Application-owned Playwright workflows exist for the main surfaces on `main`.
- [x] Staging-dependent workflows skip themselves cleanly without configuration.
- [ ] Executed in a browser (blocked: Chromium is not installed and may not be installed here; no dev server was started).
- [ ] Workflows for features in open PRs (registration and login against Supabase, profile, listings CRUD, chat, reports, admin) are added as those merge, because their pages are not on `main` yet.
- [ ] Runs in CI (the CI pipeline is a separate PR; no workflow changes here).

## Implementation

- `e2e/env.ts` holds the shared configuration flags, the navigation table and the favorites storage key.
- Specs use role and label locators with the Slovenian UI text, with no CSS selectors except the `aria-live` result heading.
- Staging-only tests use `test.skip(condition, reason)` so the reason appears in reports.

## Testing contract

- End-to-end: the specs above.
- Unit and integration: unchanged (#53 and #52).
- Manual: install Chromium (`npx playwright install chromium`), then run `npm run test:e2e`. For the staging tests, set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `E2E_LISTING_ID` and `E2E_AUTH_STATE`.

## Handoff to testing

Run the suite once with Chromium locally and once against staging with an authenticated storage state, and record any locator adjustments.

## Test status

- Automated status: Partially covered
- Test files: `e2e/navigation.spec.ts`, `e2e/auth-pages.spec.ts`, `e2e/search.spec.ts`, `e2e/favorites.spec.ts`, `e2e/listing-detail.spec.ts`, plus `e2e/contract.smoke.spec.ts`
- Scenarios covered: 32 tests are collected (`npm run test:e2e:list`) and the code type-checks. None has been executed in a browser.
- Remaining gaps: no browser run; no staging run; not in CI.
- Manual testing: Not run unless explicitly requested
