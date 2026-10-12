# Monitoring, backups, rollback, and deployment runbook

- Status: Partially implemented
- Date: 2026-10-12
- Web surfaces:
  - `docs/operations/runbook.md`;
  - the `/api/health` route (`app/api/health/route.ts`, `lib/ops/health.ts`);
  - error-boundary reporting (`lib/ops/report-error.ts`, `app/error.tsx`, `app/global-error.tsx`).
- Android behavior preserved: the runbook requires migrations to stay compatible with the Android app in the Play Store, which shares the production database, and requires checking Android against staging for migrations that touch its tables.

## Behavior

- **Runbook**, `docs/operations/runbook.md`:
  - environments, including that the service-role key never goes on the web host;
  - deployment order: expand migrations on staging, then production, then deploy, verify and contract;
  - monitoring signals and alert thresholds;
  - backups: Supabase daily backups and PITR, weekly encrypted off-site dumps, and a separate backup for the `vpisnice` Storage bucket, which database backups don't include;
  - a quarterly restore drill;
  - rollback: web-only redeploy, forward-only corrective migrations, restore from backup only for data loss, and a decision guide including a security incident path;
  - an incident checklist and the open decisions for the owner.
- **Health endpoint:**
  - `GET /api/health` (liveness): 200 `{"status":"ok"}` with the build version, or 503 when Supabase configuration is missing. It never calls Supabase.
  - `GET /api/health?deep=1` (readiness): also calls Supabase Auth `/auth/v1/health` with the anon key and a 3 s timeout, returning 503 if it is unreachable.
  - Both responses are `no-store` and `noindex`, and expose no configuration values.
- **Client error reports:** both error boundaries log one JSON line (`"event":"client_error"`) for log-based alerting. It holds the error name, Next.js digest, route with ids masked as `:id`, and version; there is no message, stack, query or user data.

## Acceptance criteria

- [x] Deployment, monitoring, backup, restore and rollback procedures are documented for the web deployment.
- [x] Health endpoints exist for uptime monitoring.
- [x] Privacy-safe client error signals for log alerting.
- [ ] Hosting platform, alerting tool, backup locations and owners chosen (owner decisions; listed under "Open decisions" in the runbook).
- [ ] The first restore drill performed (blocked: no staging or production project access).

## Implementation

- `lib/ops/health.ts`: `appVersion` (`NEXT_PUBLIC_APP_VERSION`, then `VERCEL_GIT_COMMIT_SHA`, then `GITHUB_SHA`, then "dev"), `liveness`, `readiness` (injectable `fetch` and timeout via `AbortController`), `httpStatus`.
- `app/api/health/route.ts`: a `force-dynamic` GET handler.
- `lib/ops/report-error.ts`: `maskRoute`, `buildErrorReport`, `reportError` (injectable sink, defaulting to `console.error`).
- `app/error.tsx` and `app/global-error.tsx` call `reportError` in an effect.

## Testing contract

- Unit (`tests/operations.test.ts`, 12 tests):
  - version sources;
  - liveness ok and degraded, with matching status codes, and no configuration leakage;
  - readiness success, failure, exception, timeout, and skip without configuration;
  - route masking and minimal error-report fields (the message is not included);
  - a single JSON line per error;
  - the runbook's required sections, health endpoints, the `vpisnice` backup gap and the service-role rule.
- Integration: `curl -i <host>/api/health` and `curl -i "<host>/api/health?deep=1"` after the first deployment.
- Manual: the restore drill described in the runbook.

## Handoff to testing

After deployment, add both health URLs to the uptime monitor and trigger a test error to confirm the log alert.

## Test status

- Automated status: Partially covered
- Test files: `tests/operations.test.ts`
- Scenarios covered: all unit scenarios (12 tests, passing with `npm run test`). `npm run build` includes `/api/health`.
- Remaining gaps: no deployment, monitor or restore drill; owner decisions open.
- Manual testing: Not run unless explicitly requested
