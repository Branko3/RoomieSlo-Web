# RLS and Storage policy review

- Status: Blocked pending disposable-project verification
- Date: 2026-10-07
- Web surfaces: Supabase Auth, PostgREST, Storage, Realtime, and the affected profile, listing, match, message, report, and academic-document routes
- Android behavior preserved: Existing IDs, table names, ownership relationships, public listing/profile reads, participant-only matches/messages, admin-only reports, and private `vpisnice` objects remain represented by the ordered migrations.

## Behavior

The SQL contract keeps RLS as the authorization boundary. Browser configuration is limited to
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`; no service-role credential or
document content is part of the browser source. Owner mutations are constrained to the current
user, matches and messages require participation, reports require administrator access for
administrative reads/updates, and `vpisnice` is explicitly non-public with owner/admin reads.

## Acceptance criteria

- [x] Ordered migrations define RLS, Storage, Realtime, ownership, participant, and administrator policies.
- [x] Production migrations contain no demo data and the `vpisnice` bucket is configured private.
- [x] Browser-source checks reject service-role configuration and the security contract test covers public variables.
- [x] Executable tests cover unauthenticated denial, cross-owner profile/questionnaire/listing mutation, unrelated match/message/report access, participant access, administrator report/document access, and public document URLs when staging credentials are configured.
- [ ] A fresh disposable/staging project has been provisioned and migration replay/drift checks have passed.
- [ ] Positive and negative integration tests have passed against that project, including expired sessions, signed-out clients, Storage ownership, and Realtime filtering.
- [ ] `docs/web-feature-status.md` can be marked Implemented/Autotested only after the staging suite passes.

## Implementation

`tests/supabase-security-contract.test.ts` verifies migration order, absence of production demo
rows, authenticated-only policy targets, owner/participant/admin predicates, private Storage
configuration, the `messages` publication, and restricted match acceptance. The opt-in
`tests/supabase-security.integration.test.ts` uses only anon-key clients and pre-provisioned
staging identities/data; it never creates fixtures with a service-role key.

Set the variables named in the integration test (including `RLS_*_ID` values and
`RLS_DOCUMENT_PATH`) only in a disposable or isolated staging environment. The test deliberately
skips when they are absent rather than claiming security verification.

## Testing contract

- Unit: `npm run test`, including the migration/browser-boundary contract tests.
- Integration: `npm run test` with all `RLS_*` staging variables; run `npm run db:push` and `npm run db:status` against a disposable project.
- End-to-end: Playwright authenticated/unauthenticated route checks plus denied-access states after controlled auth fixtures are available.
- Manual: Confirm bucket visibility, signed-out/expired-session behavior, Realtime authorization, and no public document fetch in the Supabase dashboard.

## Handoff to testing

Provision two ordinary users, one unrelated user, one administrator, a participant match,
messages, a report, a listing, questionnaire data, and a document under the owner's UUID.
Populate the documented `RLS_*` variables, run the integration suite, then verify expired sessions,
signed-out clients, Realtime subscriptions, atomic match acceptance, duplicate constraints,
Storage update/delete ownership, and migration replay/drift. Record exact CLI output and any
policy differences from the Android `policies.sql` and `storage_policies.sql` sources.
