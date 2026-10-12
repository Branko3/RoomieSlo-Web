# CI pipeline

- Status: Implemented
- Date: 2026-10-09
- Web surfaces: `/`, `/login`, `/register`, `/listings`, `/listings/[id]`, `/search`, `/favorites`, `/chats`, `/profile`; repository quality checks
- Android behavior preserved: This infrastructure-only change does not alter routes, Supabase data contracts, RLS, protected academic documents, pagination, compatibility calculations, realtime chat, or responsive behavior.

## Behavior

Pull requests and pushes to `main` run the same quality commands documented in the README
on Ubuntu with Node.js 20 (within the documented Node.js 18.17-or-newer requirement).
Dependencies are installed with `npm ci`, so `package-lock.json` is authoritative. Playwright
Chromium and its runner dependencies are installed before browser tests execute.

The workflow fails normally when type checking, linting, formatting, unit tests, the build, or
end-to-end tests fail. A failed Playwright run retains `playwright-report/` and
`test-results/` as diagnostics when those directories exist; artifact upload cannot turn the
failed test step into a success. The workflow requests only read access to repository contents
and does not use credentials or Supabase secrets.

## Acceptance criteria

- [x] A valid GitHub Actions workflow exists in `.github/workflows/quality.yml`.
- [x] Pull requests and pushes to the primary `main` branch are covered.
- [x] Dependencies use `npm ci`.
- [x] Typecheck, lint, format check, unit tests, build, and E2E commands run without failure masking.
- [x] Playwright Chromium is installed before `npm run test:e2e`.
- [x] Local smoke tests run without staging credentials; staging-only tests remain explicitly skipped when their documented variables are absent.
- [x] No service-role credential, private token, password, or academic document content is required or embedded.
- [x] Failed browser runs upload actionable diagnostics when available.
- [x] Application routes and Android-compatible behavior are unchanged.

## Implementation

`.github/workflows/quality.yml` uses `actions/checkout@v4`, `actions/setup-node@v4` with npm
caching, Node.js 20, and `npm ci`. It runs the six README commands in order:

```text
npm run typecheck
npm run lint
npm run format:check
npm run test
npm run build
npm run test:e2e
```

The existing Playwright configuration starts the local Next.js server in CI. The smoke tests
validate public configuration handling and URL state without Supabase variables. Listing and
authorization scenarios are explicitly skipped unless the documented public Supabase variables,
listing ID, and safe operator-created auth state are supplied. No workflow secrets are needed
for the local checks, and staging credentials are intentionally not configured here.

## Testing contract

- Unit: `npm run test` runs the Vitest suite scoped to `tests/`.
- Integration/security: No staging or service-role credentials are used by CI. Supabase RLS,
  Storage, and authenticated security checks remain deferred to a disposable/staging project.
- End-to-end: `npm run test:e2e` runs after Chromium installation and uses the local smoke suite;
  `e2e/` remains isolated from Vitest discovery.
- Manual: GitHub-hosted workflow execution and artifact retention cannot be reproduced locally.

## Handoff to testing

Validate the workflow YAML, trigger branches, Node setup, `npm ci`, command order, failure
propagation, Chromium installation, optional staging skips, credential absence, and
failure-only Playwright artifact upload. Confirm local command results separately from a
GitHub-hosted run. If staging variables are later configured, use only public Supabase values
and a safe auth state; never add a service-role key or private academic-document content.

## Test status

- Automated status: Partially covered
- Test files: `tests/ci-pipeline.test.ts`, `e2e/contract.smoke.spec.ts`
- Scenarios covered: The Vitest workflow contract suite validates YAML parsing, pull-request and
  `main` push triggers, read-only permissions, Ubuntu and Node.js 20 setup, `npm ci`, command
  order, failure propagation, Chromium installation order, credential-free smoke coverage,
  explicit staging skips, credential absence, and failure-only Playwright artifact upload. The
  full Vitest suite passed with 22 tests.
- Remaining gaps: `npm run test:e2e` discovered 14 tests, skipped 12 staging scenarios, and
  could not launch the two local smoke tests because Chromium is not installed in this
  workspace. `npm run format:check` remains blocked by 41 pre-existing repository formatting
  failures, including files outside this feature. GitHub-hosted workflow execution, artifact
  retention, staging RLS, Storage, and authenticated workflows require their respective remote
  or disposable environments.
- Manual testing: Not run unless explicitly requested
