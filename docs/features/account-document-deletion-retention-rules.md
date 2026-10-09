# Account/document deletion and retention rules

- Status: Blocked
- Date: 2026-10-09
- Automated status: Not covered
- Web surfaces: `/profile`, `/academic-verification`, `/admin/reports`, Supabase Auth, Postgres, Storage bucket `vpisnice`, backups and operational runbooks
- Android behavior preserved: Existing Auth user IDs, profile relationships, table names, nullable values, ownership rules, and private `vpisnice` Storage semantics remain the compatibility contract. Android currently has no confirmed account-deletion flow in this web repository; that behavior must be verified from the Android source before implementation. Android remains supported during the transition unless a separate approved decision changes that boundary.

## Blocker

Production implementation is blocked pending explicit product, privacy, legal, and
operations approval of the retention matrix and the dependent backend controls. The
repository currently has a prototype profile surface, no authenticated session
implementation, no academic-document upload flow, no reports/admin surface, no
development/staging/production Supabase environments, and no validated migration,
RLS/Storage, backup, monitoring, or restoration procedures. No retention period or
deletion behavior has been invented in code.

The existing relational `on delete cascade` behavior is an implementation constraint
to review, not an approved deletion policy. It does not delete Storage objects and
may conflict with report, message, safety, or legal retention requirements.

## Behavior

After the policy and backend prerequisites are approved, an authenticated user will
be able to open the privacy/account section on `/profile`, review the consequences
of deletion, and start a destructive flow. The flow must explain what is deleted
immediately, what is retained and why, the expected backup deletion lag, and that
the action is irreversible. It must require a strong explicit confirmation (for
example, entering a required confirmation phrase), verify the current session
identity, and show an explicit success or error result.

Deletion must run through a trusted server-side operation, Edge Function, or
equivalent administrative boundary. The browser may send only the authenticated
session context and approved confirmation data; it must never send an arbitrary
target user ID, service-role key, private token, password, or academic-document
content. The backend must derive the target identity from the verified session,
apply the approved relational policy, explicitly enumerate and delete all
user-owned objects under the UUID-prefixed `vpisnice` folder, and log only
redacted operational information.

On successful completion, the local Supabase session and cached profile/query data
must be cleared, the user must be signed out, and protected routes must reject the
deleted session. Repeated requests must be idempotent or return a clear
already-deleted/expired-session result. Partial failure must be surfaced as an
error with an operator-visible recovery path; the UI must not display success until
the backend completion contract is satisfied. Academic documents remain in the
private `vpisnice` bucket before and after deletion and are never exposed through
public URLs.

## Approved retention matrix

**Approval status: Pending product/privacy/legal/operations decision.** The entries
below are the required decision points, not implementation defaults. No production
code may select a retention period or silently convert a pending decision into
deletion or anonymization.

| Data category | Default deletion behavior | Required policy detail | Approval |
| --- | --- | --- | --- |
| Supabase Auth user | Permanently delete | Decide whether recent-session verification or re-authentication is required; define expired-session and already-deleted responses. | Pending |
| `profiles` | Delete or anonymize according to approved policy | Confirm interaction with the existing `auth.users` to `profiles` cascade and define whether any non-identifying operational record remains. | Pending |
| `questionnaire_answers` | Delete | Must not survive account deletion unless a documented legal basis explicitly justifies it. | Pending |
| Owned listings | Delete, anonymize, or transfer | Decide treatment of active listings, ownership transfer, public display fields, and references from favorites/matches. | Pending |
| Favorites | Delete | Confirm existing foreign-key cascade and post-deletion behavior for other users’ saved-list views. | Pending |
| Matches | Cascade, anonymize, or preserve an operational record | Decide whether match state is retained, how both participants see it, and whether messages remain reachable. | Pending |
| Messages | Define recipient-visible and legal-retention behavior | Prevent misleading chat state and define identity redaction, recipient visibility, safety holds, and any legal exception. | Pending |
| User reports | Define safety/legal retention period and anonymization | Existing reporter/reported foreign keys cascade; decide whether schema/policy changes are required to retain an anonymized report. | Pending |
| Academic documents in `vpisnice` | Explicitly delete all user-owned Storage objects | Enumerate the UUID-prefixed folder; confirm private bucket policies, orphan cleanup, admin access, and post-deletion verification. | Pending |
| Backups | Define deletion propagation and restoration handling | Approve backup retention, expected deletion lag, restore-time reprocessing, and operator evidence that deleted data is not silently recreated. | Pending |
| Logs/analytics | Remove or redact personal data | Never retain passwords, tokens, document contents, or unnecessary identifiers; define approved event fields and retention period. | Pending |

The approval record must identify the decision owner, legal/privacy basis, effective
date, environment scope (development, staging, production), and change-control
reference for every row. Until then, `Automated status` remains `Not covered`.

## User flow and authorization contract

1. An authenticated user opens `/profile` and chooses a clearly labelled account
   deletion action.
2. The UI presents the approved retention matrix, immediate effects, retained
   categories, backup lag, irreversibility, and a cancel path.
3. The user completes the required confirmation phrase or equivalent strong
   confirmation. A failed confirmation leaves the user signed in and makes no
   backend request.
4. The trusted backend verifies the session and derives the authenticated user ID.
   It does not accept a browser-supplied target user ID.
5. The operation applies the approved relational policy, deletes the user’s
   `vpisnice` Storage objects explicitly, records a redacted operational result,
   and returns success only after its completion contract is met.
6. The client clears session/cache state, signs out locally, and shows the final
   result. Protected navigation is blocked after success.

If document removal is separately exposed on `/academic-verification`, it uses the
same owner authorization, confirmation, private Storage rules, error handling, and
post-operation verification. `/admin/reports` has no user-facing deletion control;
administrators follow the approved report-retention, anonymization, backup-expiry,
and restoration procedures instead.

RLS remains the authorization boundary for relational data, and Storage policies
remain the authorization boundary for documents. Route guards and hidden controls
are not security controls.

## Backend operation and implementation record

No schema, migration, RPC, Edge Function, Storage, or client implementation has
been added because the required policy and environments are not approved. The
future implementation record must identify:

- the trusted deletion operation and its recent-session/re-authentication rule;
- every migration or schema change needed to reconcile cascades with retained
  reports/messages;
- transaction and retry/idempotency behavior, including partial-failure recovery;
- explicit listing and deletion of `vpisnice` objects under the verified user UUID;
- RLS and Storage policy changes and direct post-deletion assertions;
- cache/session cleanup and protected-route behavior in the web client;
- Android transition behavior and compatibility with existing users;
- redacted monitoring/audit events and operator access boundaries.

The browser configuration remains limited to the public Supabase URL and anon key.
Service-role credentials must never appear in browser source, `NEXT_PUBLIC_*`
variables, request payloads, logs, or error messages.

## Failure handling, backups, and operations

The approved operational procedure must cover development, staging, and production:

- use an isolated disposable or staging project for deletion tests;
- verify identity, authorization, relational outcomes, Storage object deletion,
  private-document access denial, and cache/session cleanup directly;
- surface backend denial, expired sessions, already-deleted accounts, and partial
  failures distinctly without secrets, tokens, document contents, or unnecessary
  identifiers;
- define backup retention and deletion lag, then document how a restore triggers
  reprocessing so deleted personal data is not silently recreated;
- document report/message retention and anonymization for administrators, including
  when academic-document contents are not accessible;
- define monitoring, escalation, rollback/incident response, evidence collection,
  and the rule that rollback cannot restore deleted personal data without an
  approved legal and operational decision.

Related deployment, backup, privacy, and incident runbooks must reference this
record as the single policy source instead of duplicating retention periods.

## Acceptance criteria

- [ ] `/profile` exposes a clearly labelled deletion action for an authenticated user.
- [ ] The flow explains immediate deletion, retained data, backup delay, and irreversibility.
- [ ] Explicit confirmation is required and failed confirmation makes no deletion request.
- [ ] The backend derives the target identity from the verified session.
- [ ] Deletion executes through a trusted backend boundary with no browser service-role credential.
- [ ] Every data category follows an approved retention-matrix decision.
- [ ] All user-owned `vpisnice` Storage objects are explicitly deleted.
- [ ] Successful deletion signs the user out, clears cache/query state, and blocks protected access.
- [ ] Repeated requests are safely idempotent or return a clear already-deleted/expired result.
- [ ] Partial failure is explicit, redacted, logged, and recoverable by operators.
- [ ] RLS and private Storage policies reject cross-user access before and after deletion.
- [ ] Admin procedures cover retained reports/messages, anonymization, backups, restoration, and document access.
- [ ] Development, staging, and production procedures are documented and tested.
- [ ] Android transition behavior is verified and documented.

## Testing contract

- Unit: Test the approved retention-matrix mapping for every category, confirmation
  validation and destructive-action state transitions, sensitive-data redaction,
  idempotent/already-deleted responses, cache/session cleanup, UUID-scoped
  `vpisnice` path construction, and browser/request scans for service-role keys,
  private tokens, passwords, and document contents.
- Integration: Against a disposable or staging Supabase project with two users and
  an admin, verify own-account deletion, unauthenticated/expired/wrong-user
  rejection, every approved relational rule, explicit Storage cleanup, unrelated
  document preservation, private access denial, retained-report/message access,
  repeated requests, partial-failure recovery, and backup restore reprocessing.
- End-to-end: Cover authenticated `/profile`, warning review and cancellation,
  invalid confirmation, successful deletion, final success state, sign-out and
  protected-route blocking, expired/backend-denied errors, and responsive
  keyboard/mobile/tablet/desktop behavior. Verify document cleanup through a
  staging fixture or backend assertion, never by exposing a document URL.
- Manual: Only if explicitly added to delivery scope; manual browser checks do
  not replace automated backend/security coverage.

## Handoff to testing

Testing must wait until policy approvals and an isolated Supabase environment are
available. Then turn every scenario in the Testing contract into automated
coverage, including cross-user and admin negative cases, Storage object
enumeration, report/message retention, redacted failures, retry/idempotency,
backup deletion lag, restore cleanup, and browser-bundle credential scans.

