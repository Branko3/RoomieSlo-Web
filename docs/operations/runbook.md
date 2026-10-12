# RoomieSlo web operations runbook

This runbook covers deploying, monitoring, backing up, restoring and rolling back the RoomieSlo web
app and its Supabase project. Values in angle brackets (`<…>`) are decisions or credentials the
project owner must fill in. They are listed under [Open decisions](#open-decisions).

## 1. Environments

| Environment | Web app            | Supabase project                                         | Data                                       |
| ----------- | ------------------ | -------------------------------------------------------- | ------------------------------------------ |
| Local       | `npm run dev`      | local (`supabase start`) or none                         | opt-in `supabase/seed.sql` only            |
| Staging     | `<staging URL>`    | `<staging project-ref>`                                  | disposable test accounts, never real users |
| Production  | `<production URL>` | `<production project-ref>` (shared with the Android app) | real users                                 |

Rules:

- The web app only ever receives `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. The service-role key is never set on the web host. `tests/supabase-boundary.test.ts` enforces this in code.
- Set `NEXT_PUBLIC_APP_VERSION` to the deployed commit SHA. Many hosts expose `VERCEL_GIT_COMMIT_SHA` or `GITHUB_SHA`, which are picked up automatically. The version appears in `/api/health` and in error reports.
- Production and Android share one database. Every migration must stay compatible with the Android app currently in the Play Store.

## 2. Deployment

### Before every production deployment

1. CI is green on the commit: `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run test` and `npm run build`. Once the open PRs merge, add `npm run perf:budget` and the e2e suite.
2. If the release contains migrations:
   1. Apply them to **staging** first (`supabase link --project-ref <staging>` then `npm run db:push`).
   2. Run `npm run test:integration` against staging, once the integration suite has merged.
   3. Take a production backup (section 4) and note its timestamp in the release notes.
3. Check the Android app against staging if a migration touches tables it reads or writes.

### Order of operations

1. **Expand:** apply backward-compatible migrations to production (`npm run db:push` linked to production). Forward-only: never edit an applied migration.
2. **Deploy** the web build.
3. **Verify** (section 3): `GET /api/health` and `GET /api/health?deep=1` return 200 with the new `version`; sign in, open listings, send a test message on a staging account.
4. **Contract:** remove old columns or policies only in a later release, after both clients have stopped using them.

A migration that can't be made backward compatible needs a maintenance window and an Android release plan agreed before deployment.

## 3. Monitoring

| Signal                            | Source                                                                                                     | Alert when                                                  |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Liveness                          | `GET /api/health`: 200 `{"status":"ok"}`; 503 if Supabase variables are missing                            | 2 consecutive failures, 1-minute interval                   |
| Readiness                         | `GET /api/health?deep=1` also calls Supabase Auth `/auth/v1/health` with a 3 s timeout; 503 if unreachable | 3 consecutive failures, 5-minute interval                   |
| Client errors                     | Host logs: JSON lines with `"event":"client_error"` from the error boundaries (`lib/ops/report-error.ts`)  | more than `<N>` per 5 minutes, or any `"boundary":"global"` |
| Database, Auth, Storage, Realtime | Supabase dashboard: API and Postgres logs, usage, and the advisors (security and performance)              | per Supabase project alerts; review the advisors weekly     |
| Bundle size                       | `npm run perf:budget` in CI                                                                                | the build exceeds `perf-budget.json`                        |

Error reports contain no personal data. They hold only the error name, the Next.js digest, the route with ids masked as `:id`, and the version. Messages and stacks are not logged, because they can contain user input. Use the digest to find the server-side log entry.

Health responses are `no-store` and `noindex`. They expose no user data and no secrets: only the status, version, time and which checks passed.

## 4. Backups

| What                                              | Mechanism                                                                                                                                                  | Frequency and retention                                                                  | Owner      |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------- |
| Postgres (all tables, RLS, functions)             | Supabase managed backups; enable Point-in-Time Recovery on production                                                                                      | daily, retained 30 days (approved retention matrix); PITR window `<days>`                | `<owner>`  |
| Postgres, off-site copy                           | `supabase db dump --linked -f backup-<date>.sql` (schema) and `supabase db dump --linked --data-only -f data-<date>.sql`, stored encrypted in `<location>` | weekly, keep 8 weeks                                                                     | `<owner>`  |
| Storage bucket `vpisnice` (academic documents)    | **Not included in database backups.** Copy objects with `supabase storage cp -r ss:///vpisnice <encrypted location>`                                       | weekly, keep 8 weeks; delete copies on the same schedule as the source (retention rules) | `<owner>`  |
| Migrations and policies                           | Git (`supabase/migrations`)                                                                                                                                | every commit                                                                             | developers |
| Auth settings, email templates, API keys, secrets | Not in SQL. Record the settings (not the secrets) in `<settings record>`; secrets live in the host's secret store                                          | on every change                                                                          | `<owner>`  |

Backups hold personal data: profiles, messages and academic documents. Store them encrypted, restrict access to `<owner>`, and apply the deletion and retention procedures to backups too.

### Restore drill (quarterly)

1. Create a disposable Supabase project.
2. Restore the latest daily backup, or load the off-site dump with `psql`.
3. Point a local web build at it and run `npm run test:integration` and a manual sign-in.
4. Record the time to restore and any problems in `<drill log>`. Delete the project afterwards.

## 5. Rollback

### Web app only (no migration in the release)

1. Redeploy the previous successful build in the host's dashboard, or revert the merge commit on `main` and deploy.
2. Verify `/api/health` reports the previous `version`.

### Release with migrations

Migrations are forward-only, so **do not run destructive "down" SQL on production.**

1. If the expand step was backward compatible (the normal case), roll back the web app only. The extra columns or policies are harmless to the old build.
2. If a migration is wrong, write a new corrective migration, test it on staging, then apply it.
3. Restore from backup (section 4) only for data loss or corruption, because it discards every write since the backup:
   - prefer PITR to just before the incident;
   - announce the window and the lost writes to users;
   - Android users may need to sign in again.

### Decision guide

| Symptom                                                             | Action                                                                                                                                                                                                                                |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pages error after deployment, `/api/health` is 200                  | roll back the web app                                                                                                                                                                                                                 |
| `/api/health?deep=1` is 503, Supabase status page shows an incident | wait for Supabase; post a status note; no rollback                                                                                                                                                                                    |
| A migration failed partway                                          | keep the error output; fix it in a new migration (README "Migrations are forward-only")                                                                                                                                               |
| Users see others' data                                              | **security incident**: roll back the web app, revoke affected sessions in the Supabase dashboard, fix RLS in a new migration, then follow the data breach procedure (`<procedure>`, GDPR notification within 72 hours where required) |

## 6. Incident checklist

1. Acknowledge the alert and note the start time.
2. Check `/api/health?deep=1`, the Supabase status page and the host status page.
3. Decide using section 5. Roll back first and investigate after.
4. Communicate to users through `<channel>`.
5. Write a short post-incident note (cause, impact, fix, follow-ups) in `<location>`.

## Open decisions

- The hosting platform for the web app, and the staging and production URLs.
- Production and staging project refs; whether PITR is enabled, and its window.
- The backup retention period and encrypted off-site storage location; the owners.
- The alerting tool for the health checks and log alerts, and the client-error threshold `<N>`.
- The user communication channel and the data breach procedure owner.
