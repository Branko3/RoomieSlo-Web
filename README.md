# RoomieSlo Web

Responsive Next.js prototype for the RoomieSlo roommate finder. The visual language follows
the Android Compose app: deep green and amber accents, rounded cards, compact status chips,
and the same Slovenian navigation labels.

## Run locally

1. Install Node.js 18.17 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`, set `ROOMIESLO_ENV=development`, and add the isolated
   development project's public Supabase URL and anon key.
4. Run `npm run validate:env`, then `npm run dev` and open `http://localhost:3000`.

The current UI uses the Android app's preview data in `lib/data.ts`, so it can be explored
without credentials. The browser Supabase client is ready in `lib/supabase/browser.ts` and
intentionally fails explicitly when credentials are not configured.

## Supabase migrations

SQL ownership is now in this repository under `supabase/migrations`. The source of the
baseline is recorded in each migration and was copied from the Android repository without
renaming tables, columns, status values, or ownership relationships. Install the Supabase CLI,
link a development or staging project, and apply the ordered chain with:

```powershell
supabase login
supabase link --project-ref <project-ref>
npm run db:push
npm run db:status
```

`supabase/seed.sql` is opt-in local development data only. It is empty by default so production
and staging migrations never insert demo listings. For a disposable local database, `supabase
db reset` applies migrations and then the seed file. Never use `db reset` on a shared project.

Environment promotion, project ownership, deployment variables, Auth/Storage/Realtime settings,
backup requirements, and the staging fixture boundary are documented in
`docs/features/development-staging-production-environments.md`. The same build is promoted by
injecting environment variables at deployment time; no route or authorization code changes per
environment.

Migrations are forward-only. If an apply fails, preserve the error and migration state, fix the
SQL in a new migration (do not edit an applied migration), then rerun `npm run db:push`. Before
production use, take a Supabase backup and verify the migration chain on a disposable project.
`20261007000003_indexes_and_matching.sql` intentionally stops with an explicit error when
duplicate match pairs already exist; resolve those records with an approved data decision before
retrying. Storage bucket configuration, RLS policies, the Auth profile trigger, and the
`messages` Realtime publication are all represented in SQL. Supabase project settings outside
SQL (Auth providers, email delivery, API keys, backups, and environment secrets) remain
operator-managed.

The chain is forward-only, including policy fixes. After a failed apply, capture the CLI error
and migration status, add a new timestamped migration, and rerun `npm run db:push`; never edit
an applied migration. For a disposable local replay, use `supabase db reset` and then
`npm run db:status`. Do not run `db reset` against staging or production.

## Quality checks

```text
npm run typecheck
npm run lint
npm run format:check
npm run test
npm run build
npm run test:e2e
```

Playwright browser tests are isolated under `e2e/` and do not discover the Vitest files under
`tests/`. `npm run test:e2e` starts a local Next.js server by default. Install the browser once
with `npx playwright install chromium`. Public configuration and URL-state smoke tests run
locally; staging listing tests are explicitly skipped unless
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `E2E_LISTING_ID`, and an
operator-created `E2E_AUTH_STATE` file are provided. The auth state must contain only safe
staging credentials and is ignored by Git. Never use a service-role key in browser tests.

The initial prototype includes responsive listing/search/favorite/chat/profile views, auth entry
screens, listing details, shared loading/error/not-found states, keyboard-friendly navigation,
and a TanStack Query provider for upcoming data-backed features.
