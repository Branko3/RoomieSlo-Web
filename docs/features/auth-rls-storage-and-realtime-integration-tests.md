# Auth, RLS, Storage, and Realtime integration tests

- Status: Partially implemented
- Date: 2026-10-11
- Web surfaces: the test suite in `integration/`, `vitest.integration.config.ts`, the `npm run test:integration` script, and new `.env.example` entries. No application code changes.
- Android behavior preserved: not applicable. The suite exercises the same Supabase project, policies and bucket that Android uses, through the public API as ordinary users.

## Behavior

- `npm run test:integration` runs four files against a **disposable or staging** Supabase project:
  - `auth.int.ts`: sign-in and `getUser`; a wrong password gets no session; anonymous visitors get no rows from any application table and cannot write; sign-out ends the session.
  - `rls.int.ts`: user A against user B's data.
    - Profiles: read allowed; update, impersonated insert and self-verification refused.
    - Listings: a forged owner is refused; update and delete of B's listing are ignored.
    - Favorites are private, and favorites or answers in B's name are refused.
    - Match requests and messages in B's name are refused, and A cannot rewrite B's message.
    - Reports can only be filed as yourself, are hidden from non-admins, and non-admin status updates are ignored. Nobody can make themselves an admin. An admin can read reports (optional).
  - `storage.int.ts` (`vpisnice`):
    - a user can upload into their own `<uid>/` folder only, not another user's folder or the bucket root;
    - another user cannot list, download, overwrite or delete the file;
    - the bucket is not public (no anonymous download and no working public URL).
  - `realtime.int.ts`:
    - a new message reaches the other participant but not an anonymous subscriber;
    - a removed channel stops receiving.
- **Opt-in and safe by construction:**
  - without the `SUPABASE_TEST_*` variables every file is skipped, with a one-line hint;
  - `npm run test` never includes it (`*.int.ts` is outside `tests/**/*.test.ts`);
  - a service-role or `sb_secret_` key is refused, because it would bypass RLS;
  - users A and B must be different accounts.
- **Data hygiene:**
  - rows and files carry an `it-…` marker; listings, favorites and uploads are removed afterwards;
  - matches and messages have no delete policy, so one A↔B match is reused and its marked test messages remain.
- **Tests for known gaps:** these fail until the matching fixes are applied, which is intended:
  - self-verification (PR #20, fixed by PR #51);
  - rewriting another participant's message (PR #42, still open).

## Configuration

Set these in the environment (see `.env.example`), never in committed files:

- `SUPABASE_TEST_URL` and `SUPABASE_TEST_ANON_KEY` (the anon or publishable key);
- `SUPABASE_TEST_USER_A_EMAIL` / `_PASSWORD` and `SUPABASE_TEST_USER_B_EMAIL` / `_PASSWORD`: two confirmed, non-admin accounts;
- optional: `SUPABASE_TEST_ADMIN_EMAIL` / `_PASSWORD`, an account listed in `public.admins`.

## Acceptance criteria

- [x] An automated suite covers Auth, RLS (profiles, listings, favorites, answers, matches, messages, reports, admins), Storage (`vpisnice`) and Realtime (messages).
- [x] Negative-access cases cover anonymous visitors and another user.
- [x] The suite can't run with a service-role key and doesn't affect `npm run test`.
- [ ] The suite has been run against staging and passes (blocked: no staging project or credentials; known gaps are expected to fail until their fixes merge).
- [ ] Wired into CI with secrets (needs a staging project; no workflow changes in this PR).

## Implementation

- `integration/env.ts`: `readIntegrationEnv` (missing variables, service-role/secret key refusal, URL and distinct-user checks) and `jwtRole`.
- `integration/clients.ts`: anon and signed-in clients (no session persistence), `skip`, `marker`, `isRlsRefusal`.
- `integration/{auth,rls,storage,realtime}.int.ts`.
- `vitest.integration.config.ts`: `integration/**/*.int.ts`, run serially, 30 s timeouts.
- `package.json`: the `test:integration` script. `.env.example`: the integration variables.

## Testing contract

- Unit (`tests/integration-env.test.ts`):
  - configuration parsing, the missing-variable list, the optional admin;
  - refusal of service-role and secret keys, acceptance of publishable keys;
  - URL and distinct-user checks, and `jwtRole`;
  - suite layout: all four areas exist, every file uses `describe.skipIf(skip)`, none references a service role, and none is picked up by the unit run.
- Integration: the suite itself, on staging.
- End-to-end: none.
- Manual: create the two test accounts (and optionally an admin) on staging.

## Handoff to testing

Provision a staging project with all migrations applied, add the test accounts, export the variables and run `npm run test:integration`. Record failures; the known-gap tests should fail until their fixes are merged.

## Test status

- Automated status: Partially covered
- Test files: `tests/integration-env.test.ts` (8 tests, passing with `npm run test`); `integration/*.int.ts` (25 tests, skipped without configuration)
- Scenarios covered: configuration safety and suite layout. The database scenarios are written but not executed.
- Remaining gaps: no staging run; not in CI.
- Manual testing: Not run unless explicitly requested
