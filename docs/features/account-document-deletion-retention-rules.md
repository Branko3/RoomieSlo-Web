# Account/document deletion and retention rules

- Status: Approved policy (implementation pending)
- Date: 2026-10-09 (policy approved 2026-10-12)
- Automated status: Not covered
- Web surfaces: `/profile`, `/academic-verification`, `/admin/reports`, Supabase Auth, Postgres, Storage bucket `vpisnice`, backups and operational runbooks
- Android behavior preserved: Existing Auth user IDs, profile relationships, table names, nullable values, ownership rules, and private `vpisnice` Storage semantics remain the compatibility contract. Android currently has no confirmed account-deletion flow in this web repository; that behavior must be verified from the Android source before implementation. Android remains supported during the transition unless a separate approved decision changes that boundary.

## Policy approval

The retention policy below was approved on 2026-10-12 by Branko (project owner and data
controller for this thesis project). Legal basis: GDPR art. 17 (erasure) for the account
holder's data, and art. 6(1)(f) (legitimate interest in user safety) for the limited
retention of report evidence. It is effective from 2026-10-12 for development, staging and
production. Changes require a new approval recorded in this file (change control: pull
request against this record).

This record approves the **policy**. It is the single policy source for
`docs/operations/privacy-procedures.md` and `docs/operations/runbook.md`. The self-service
deletion flow, the schema changes and the admin message view described below are **not
implemented yet**; they are follow-up work (see "Implementation status").

## Implementation status

Already on main: authentication and session restoration, route guards, the profile and
academic-document upload (`vpisnice`), reports and the admin report dashboard, the admin
authorization boundary, the `/privacy` page with self-service data export and manual
deletion procedures, and the operations runbook.

Still to build (follow-up PR, in this order):

1. **Migration: reconcile cascades with this policy.** Today `auth.users` deletion cascades
   to the user's messages, matches and every report involving them, which contradicts rows
   6–8. Change `messages.sender_id`, `matches.user_id_a/b` and `reports.reporter_id/
reported_id` so the rows survive with the deleted user anonymized (nullable reference
   or a fixed "deleted user" sentinel), and add the 12-month report-evidence retention.
2. **Report evidence.** When a report is filed from a chat, keep the reported conversation
   (snapshot or a hold that blocks its deletion) until the report's retention ends.
3. **Admin message access (approved option 1).** In-app admins can read only conversations
   linked to a report, through a security-definer function or policy, and every read is
   recorded in an append-only audit table (admin id, conversation, time).
4. **Self-service deletion** on `/profile` through a trusted server operation (Edge
   Function), following the flow and contracts below.
5. **Retention jobs**: purge closed-report evidence after 12 months, conversations whose
   participants have all deleted their accounts, and logs after 90 days.

Until step 1 lands, operators must not delete accounts that have reports or messages
another user may need (see `docs/operations/privacy-procedures.md`).

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

**Approval status: Approved 2026-10-12 (Branko, project owner).**

| Data category                    | Approved behavior                                | Detail                                                                                                                                                                                                                                                                                                                                                       | Approval |
| -------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| Supabase Auth user               | Permanently delete                               | Re-authentication is required when the last sign-in is older than 10 minutes. An expired session returns "sign in again"; an already-deleted account returns a clear already-deleted result.                                                                                                                                                                 | Approved |
| `profiles`                       | Delete                                           | No identifying record remains. Other users see "Izbrisan uporabnik" wherever the profile was referenced.                                                                                                                                                                                                                                                     | Approved |
| `questionnaire_answers`          | Delete                                           | Nothing is retained.                                                                                                                                                                                                                                                                                                                                         | Approved |
| Owned listings                   | Delete                                           | Deleting a listing also removes it from other users' favorites (existing cascade).                                                                                                                                                                                                                                                                           | Approved |
| Favorites                        | Delete                                           | The user's own favorites rows are deleted.                                                                                                                                                                                                                                                                                                                   | Approved |
| Matches                          | Keep, anonymized                                 | The match stays for the other participant, with the deleted user shown as "Izbrisan uporabnik".                                                                                                                                                                                                                                                              | Approved |
| Messages                         | Keep in the other participant's chat, anonymized | Messages linked to a report are retained, anonymized, for 12 months after the report is closed. Unreported conversations are deleted once all participants have deleted their accounts. The database owner (project owner, via Supabase) can read all messages. In-app admins can read only conversations linked to a report, and every such read is logged. | Approved |
| User reports                     | Keep, anonymized                                 | Reports made by or about the user are kept, anonymized, for 12 months after the report is closed, then deleted.                                                                                                                                                                                                                                              | Approved |
| Academic documents in `vpisnice` | Delete immediately                               | Every object under the user's UUID folder is enumerated and deleted, then verified.                                                                                                                                                                                                                                                                          | Approved |
| Backups                          | Expire after 30 days                             | Deleted data can remain in backups for up to 30 days. If a backup is restored, every deletion recorded since the backup date is re-applied before the service reopens.                                                                                                                                                                                       | Approved |
| Logs/analytics                   | Minimal fields, 90 days                          | Keep only the request id, date and outcome; never passwords, tokens, document contents or message text. Deleted after 90 days.                                                                                                                                                                                                                               | Approved |
| Admin access to messages         | Reported conversations only                      | Database owner: full access through Supabase for operations and abuse handling. In-app admins: only conversations linked to a report, with an audit record for every read. The privacy notice discloses this.                                                                                                                                                | Approved |

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
been added yet; the policy is approved and the work is listed under "Implementation
status". The implementation record must identify:

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

The policy is approved; testing waits for the follow-up implementation and an
isolated Supabase environment. Then turn every scenario in the Testing contract into automated
coverage, including cross-user and admin negative cases, Storage object
enumeration, report/message retention, redacted failures, retry/idempotency,
backup deletion lag, restore cleanup, and browser-bundle credential scans.
