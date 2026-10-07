# Development, staging, and production environments

- Status: Blocked pending operator provisioning and live validation
- Date: 2026-10-07
- Web surfaces: `.env.example`, `lib/config.ts`, `playwright.config.ts`, `supabase/`
- Android behavior preserved: Existing Auth accounts, shared table names, RLS/Storage intent, private academic documents, and `messages` Realtime behavior are unchanged. Production Android clients continue to use their existing production project.

## Behavior

The application uses configuration injection rather than environment-specific route or
authorization code. Browser code receives only `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY`. `ROOMIESLO_ENV` is deployment-managed and is never required by
the browser client. `lib/config.ts` rejects missing public configuration, local/insecure staging
or production endpoints, and a JWT whose role is `service_role`. Missing browser configuration
continues to produce the existing actionable Supabase error.

The intended matrix is:

| Environment | Supabase project                                                  | Web target                 | Data and credentials                                                    |
| ----------- | ----------------------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------- |
| Development | Dedicated development project or local Supabase instance          | `next dev`                 | Disposable developer data; local `.env.local`; optional local seed only |
| Staging     | Dedicated staging project                                         | Preview/staging deployment | Disposable staging users, fixtures, and ignored `E2E_AUTH_STATE`        |
| Production  | Dedicated production project shared with released Android clients | Production deployment      | Real users/data; hosting-provider secrets only                          |

Project references, domains, Auth redirect URLs, email delivery, API settings, private
`vpisnice` Storage, `messages` Realtime publication, backups, and recovery ownership must be
configured separately by the Supabase/hosting operators. They are intentionally not committed.

## Acceptance criteria

- [x] The public and test-only configuration contract is documented in `.env.example`.
- [x] Local/test secrets, environment files, and Playwright auth state are ignored by Git.
- [x] Browser Supabase setup uses only the two public variables and fails explicitly when absent.
- [x] Environment validation rejects missing configuration and unsafe staging/production endpoints.
- [x] The same source/build can be promoted by injecting deployment configuration.
- [x] Ordered migrations and the local-only seed boundary are preserved.
- [ ] Dedicated development, staging, and production Supabase projects are provisioned and references recorded by an operator.
- [ ] Separate hosting targets, approved domains, redirects, Auth providers, email, Storage, Realtime, backups, and recovery ownership are configured and verified.
- [ ] Staging migration, RLS/Storage/Realtime, Android compatibility, and Playwright authenticated checks pass against disposable infrastructure.

## Implementation

Use one deployment artifact and set the variables at process/deployment start:

```powershell
$env:ROOMIESLO_ENV = "development" # staging or production on the corresponding target
$env:NEXT_PUBLIC_SUPABASE_URL = "<environment project URL>"
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY = "<environment anon key>"
npm run validate:env
```

`E2E_BASE_URL`, `E2E_LISTING_ID`, and `E2E_AUTH_STATE` are local/staging-only test inputs.
`E2E_AUTH_STATE` must contain only disposable staging sessions and must remain under an ignored
auth-state path. Service-role keys, database passwords, access tokens, academic-document
contents, and production credentials are operator-managed and must not be supplied to browser
tests or public environment variables.

Apply the ordered migration chain to development and staging only after linking the intended
project:

```powershell
supabase login
supabase link --project-ref <development-or-staging-ref>
npm run db:push
npm run db:status
```

Production promotion requires a verified Supabase backup, an operator-approved maintenance
window, migration-state inspection, and `npm run db:push` only. Migrations are forward-only:
never run `supabase db reset` against staging or production and never edit an applied migration.
Development seed data is applied only through the explicit local `supabase db reset` workflow;
`supabase/seed.sql` remains empty by default and is not part of production migration execution.

## Promotion procedure

1. Run `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, and
   `npm run validate:env` with development configuration.
2. Promote the unchanged build to staging, apply migrations in order, inspect
   `npm run db:status`, and run `npm run test:e2e` with disposable staging fixtures.
3. Verify negative RLS/Storage cases, Auth redirects/session restoration, private `vpisnice`,
   Realtime messages, and staging/production project isolation.
4. Back up production, inspect its migration state, apply forward-only migrations, and deploy
   the same artifact with production-injected configuration.
5. If deployment fails, roll back the application artifact only; do not roll back the database by
   editing or resetting migrations. Recovery ownership and any forward corrective migration must
   be recorded by the operators.

## Testing contract

- Unit: `tests/environment-config.test.ts` validates required variables, environment names,
  endpoint safety, and service-role rejection.
- Integration: `tests/reproducible-sql-migrations.integration.test.ts` requires an isolated
  disposable project and explicit `SUPABASE_TEST_*` credentials; it has not run here.
- End-to-end: `npm run test:e2e` covers local/public configuration and optional authenticated
  staging listing flows. Staging authorization, fixtures, and live redirects require operator
  setup.
- Manual: Verify project identity, Auth email links, Storage privacy, Realtime, isolation,
  backup/recovery, and artifact rollback in each provisioned environment.

## Validation performed

Repository tests and static checks are the verification available in this workspace. On
2026-10-07, `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`,
`npm run format:check`, and `npm run test:e2e` must be run after this change. Live Supabase CLI
migration, project isolation, deployment, backup, RLS/Storage/Realtime, and authenticated
staging checks are blocked because no operator-managed projects, hosting targets, or disposable
credentials are available.

## Handoff to testing

Provision three distinct project references and deployment targets, then run the commands above.
Assert that staging fixtures cannot read production data, production credentials are rejected by
staging configuration, no seed rows appear after migration application, private academic
documents have no public URL, and all representative positive/negative RLS and Realtime tests
pass. Record project references and verification results outside source control.
