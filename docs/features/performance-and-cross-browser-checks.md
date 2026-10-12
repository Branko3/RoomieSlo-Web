# Performance and cross-browser checks

- Status: Partially implemented
- Date: 2026-10-12
- Web surfaces:
  - `scripts/bundle-budget.mjs` (with `.d.mts` types), `perf-budget.json`, the `perf:budget` script;
  - `e2e/browsers.ts`, `playwright.config.ts`;
  - `browserslist` in `package.json`.
  - No application code changes.
- Android behavior preserved: not applicable.

## Behavior

- **JavaScript budget:** `npm run perf:budget`, run after `npm run build`, measures the gzipped first-load JavaScript of every App Router page from the build manifests: shared root chunks plus every wrapping layout plus the page, each file counted once. It prints a table and exits 1 if anything is over `perf-budget.json`:
  - shared at most 100 kB;
  - each route at most 200 kB, unless `routes` overrides it.

  Measured on `main`:

  | Route                                                  | First-load JS (gzip) |
  | ------------------------------------------------------ | -------------------- |
  | shared                                                 | 85.5 kB              |
  | `/`, `/chats`, `/login`, `/profile`, `/register`       | about 103 kB         |
  | `/listings`, `/listings/[id]`, `/favorites`, `/search` | about 172–173 kB     |

  The roughly 70 kB jump on the data pages is the Supabase client. It is a candidate for a lazy import if the budget tightens.

- **Cross-browser runs:**
  - Chromium remains the default.
  - `E2E_BROWSERS=firefox,webkit,mobile-chrome,mobile-safari` adds Playwright projects (Desktop Firefox, Desktop Safari/WebKit, Pixel 7, iPhone 14) that run every e2e spec, after `npx playwright install firefox webkit`.
  - Unknown names fail loudly instead of being skipped.
- **Supported browsers:** `browserslist` declares the Next.js 14 default targets (Chrome 64, Edge 79, Firefox 67, Opera 51, Safari 12), so the support matrix is explicit and reviewable. The build output doesn't change.

## Acceptance criteria

- [x] An automated, enforceable performance budget based on build output.
- [x] A cross-browser matrix (Firefox, WebKit, mobile Chrome and Safari) is available to every e2e spec.
- [x] Supported browsers are declared.
- [ ] Cross-browser runs executed (blocked: browsers can't be installed here).
- [ ] Runtime Web Vitals (LCP, INP, CLS) measured on a deployment with Lighthouse or real-user monitoring (blocked: no deployment). This belongs with "Monitoring, backups, rollback, and deployment runbook".
- [ ] Budget enforced in CI (the CI pipeline is a separate PR; no workflow changes here).

## Implementation

- `scripts/bundle-budget.mjs` exports `layoutChain`, `routeOf`, `firstLoadFiles`, `checkBudget` and `measure`, and runs as a CLI when executed directly. The `.d.mts` file types it for tests.
- `e2e/browsers.ts` defines `BROWSER_PROJECTS`, `parseBrowsers` and `crossBrowserProjects`. `playwright.config.ts` spreads them into `projects`.

## Testing contract

- Unit (`tests/performance-budget.test.ts`, 10 tests):
  - layout chain and route mapping;
  - first-load file collection (deduplicated, layouts included, CSS ignored);
  - budget failures and overrides, and that the committed budget is sane;
  - cross-browser parsing (default empty, deduplicated, mobile engines, unknown names rejected);
  - the `browserslist` value.
- Build-level: `npm run build && npm run perf:budget` passes on `main` (output above).
- End-to-end: `E2E_BROWSERS=firefox,webkit npx playwright test --list` collects the matrix; it hasn't been executed.
- Manual: Lighthouse on a deployment.

## Handoff to testing

Install Firefox and WebKit, then run `E2E_BROWSERS=firefox,webkit,mobile-safari npm run test:e2e`. Run Lighthouse against a deployment and record LCP, INP and CLS.

## Test status

- Automated status: Partially covered
- Test files: `tests/performance-budget.test.ts`
- Scenarios covered: the budget logic and browser matrix configuration. The budget passes on the current build.
- Remaining gaps: no cross-browser execution; no Web Vitals; not in CI.
- Manual testing: Not run unless explicitly requested
