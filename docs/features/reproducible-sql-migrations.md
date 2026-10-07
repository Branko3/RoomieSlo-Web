# Reproducible SQL migrations

- Status: Blocked pending fresh-project and security validation
- Date: 2026-10-07
- Web surfaces: `supabase/migrations`, `supabase/seed.sql`, Supabase Auth/Postgres/Storage/Realtime
- Android behavior preserved: The Android schema, table and column names, nullable fields, status checks, timestamps, ownership relationships, display-field migration, Auth profile trigger, RLS, private `vpisnice` bucket, and `messages` Realtime publication are carried forward without renaming.

## Behavior

The web repository owns an ordered Supabase migration chain. Applying it to a clean project
creates the shared schema, policies, private academic-document bucket, Auth profile trigger,
indexes, Realtime publication, duplicate favorite/match protections, and an atomic
participant-only match acceptance function. Demo data is not part of production migrations;
`supabase/seed.sql` is the explicit local-only seed entry point.

Migrations are forward-only and idempotent where supported by PostgreSQL. A failed migration
must be repaired with a new migration rather than by editing an applied file. The matching
index migration deliberately fails with a diagnostic if pre-existing duplicate pairs would
make the constraint unsafe to install.

## Acceptance criteria

- [x] Migration ownership and Android source handoff are documented.
- [x] Ordered production migrations include the baseline, policies/storage, display fields, indexes, and Realtime configuration.
- [x] Demo data is isolated from production migration execution.
- [x] Existing Android names, status values, nullability, and ownership relationships are preserved.
- [x] Duplicate favorite protection and canonical duplicate-match protection are represented.
- [x] Match acceptance is atomic and participant-authorized through `accept_match(uuid)`.
- [x] Update policies revalidate participant/admin authorization and private Storage paths.
- [x] Environment setup, migration state inspection, failure recovery, and operator-managed Supabase settings are documented.
- [ ] Fresh staging application and replay/drift checks have passed.
- [ ] Android representative-data compatibility has been executed against a disposable project.
- [ ] Positive and negative RLS/Storage security checks have passed with multiple authenticated users and an admin.

## Implementation

| Migration | Android source / responsibility |
| --- | --- |
| `20261007000000_android_baseline.sql` | `schema.sql` and `auth_trigger.sql`; core tables, checks, trigger, and Realtime publication |
| `20261007000001_security_and_storage.sql` | `policies.sql` and `storage_policies.sql`; RLS, private `vpisnice` bucket, and Storage policies |
| `20261007000002_display_fields.sql` | `migrations/0002_polja_za_prikaz.sql`; listing/profile display columns and partial index |
| `20261007000003_indexes_and_matching.sql` | `migrations/0001_indeksi.sql` plus web-required canonical match uniqueness and atomic acceptance RPC |
| `20261007000004_policy_update_hardening.sql` | Forward-only checks for participant, admin, and private Storage updates |

Android `migrations/0003_demo_oglasi.sql` was not copied into production migrations because it
mutates existing rows and fabricates presentation data. It remains an explicit follow-up seed
conversion if local demo data is needed.

## Testing contract

- Unit: SQL structure and migration ordering should be checked by the Supabase CLI and schema assertions.
- Integration: Apply the full chain to a disposable Supabase project, inspect migration state, replay using the CLI's supported workflow, and compare tables, columns, constraints, indexes, functions, triggers, policies, Storage, and Realtime.
- End-to-end: With two users and an admin, verify Auth/profile creation, owner listing mutations, questionnaire/favorite ownership, match/message participation, admin reports, private academic documents, duplicate prevention, and concurrent match acceptance.
- Manual: Confirm Auth providers, email delivery, backups, API keys, and environment secrets are configured outside SQL; never use `db reset` on a shared project.

## Validation performed

The repository-level checks are `npm run typecheck`, `npm run lint`, `npm run test`, and
`npm run build`. Database validation must be run from a linked disposable or staging project:

```powershell
npm run db:push
npm run db:status
supabase db diff
```

For replay validation, use `supabase db reset` only against a disposable local database, then
rerun `npm run db:status` and compare the schema/resource assertions listed above. For recovery,
introduce a controlled failure in a disposable copy, preserve the error and failed status, add a
new forward-fix migration, and rerun `npm run db:push`; the applied migration must remain
unchanged.

On 2026-10-07 in the repository workspace, `npm run typecheck`, `npm run lint`, `npm run test`,
and `npm run build` passed; Vitest reported 20 passing tests across three files. The Supabase
CLI and a disposable/staging project were not available in this environment, so fresh-project,
replay/drift, migration-failure recovery, representative Android-data, RLS, Storage, Realtime,
and concurrency checks remain unverified. The record is intentionally not marked `Implemented`.

## Handoff to testing

Provision a disposable project and run `npm run db:push` followed by `npm run db:status`. Assert
that no demo rows are inserted. Execute positive and negative access tests for every policy
surface, confirm `vpisnice` is not public and produces no public URL, subscribe to `messages`,
attempt duplicate favorites and reversed match pairs, and race two authenticated acceptance
requests against the same pending match. Test a deliberate migration failure and document the
forward-fix result.

## Test status

- Automated status: Partially covered
- Test files: `tests/reproducible-sql-migrations.test.ts`, `tests/reproducible-sql-migrations.integration.test.ts`
- Scenarios covered: Offline migration ordering, seed isolation, Android schema and status compatibility, Auth trigger and Realtime declarations, RLS and Storage policy declarations, duplicate protections, atomic match acceptance, setup/recovery documentation, and an opt-in disposable-project suite for demo-row, multi-user authorization, private Storage, Realtime, duplicate, reversed-pair, and concurrent-acceptance checks.
- Remaining gaps: The opt-in integration suite was skipped because `RUN_SUPABASE_INTEGRATION=1` and disposable `SUPABASE_TEST_*` credentials were unavailable. Fresh-project `db:push`, `db:status`, replay/drift comparison, deliberate migration failure and forward-fix execution, representative Android data, and live policy/Storage/Realtime/concurrency checks therefore remain unverified. The Supabase CLI was not installed.
- Manual testing: Not run unless explicitly requested
