# Account/document deletion and retention rules

- Status: Approved policy (implementation in progress)
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

**Tombstones and safety identity record (approved 2026-10-13, Branko).** A deleted account's
`profiles` row is scrubbed into a tombstone ("Izbrisan uporabnik", every identifying field
emptied, `deleted_at` set) instead of being removed, so matches, messages and reports keep a
valid reference. The e-mail and name are kept in `deleted_user_safety_records`, readable only by
the database owner, for 30 days after deletion or 12 months after the last report about the
person closes, whichever is later (legal basis: GDPR art. 17(3)(e) and art. 6(1)(f)).

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

1. **Done: migration `20261014000000_account_deletion_tombstones.sql`.** A `before delete`
   trigger on `auth.users` applies the matrix and turns the profile into a tombstone; the
   profile no longer cascades from Auth. Reports gain `match_id` and `closed_at`.
2. **Done: migration `20261014000100_report_evidence.sql`.** Reports are filed only through
   `submit_report`. A chat report snapshots the last 200 messages of that conversation into
   `report_evidence` with "reporter"/"reported" roles instead of user ids; the snapshot is
   deleted with its report.
3. **Done: migration `20261014000200_admin_report_conversation.sql`.** In-app admins read a
   reported conversation only through `admin_report_conversation`, which records every read
   in the append-only `admin_message_reads` (admin, report, time) before returning the
   evidence snapshot (or, for older reports, the linked live conversation) by role.
   `/admin/reports` shows it on request ("Prikaži pogovor").
4. **Done: self-service deletion.** `/profile` → "Izbriši račun" → `/profile/delete-account`
   explains what is deleted and kept, then asks for the password and the phrase "IZBRIŠI".
   The page signs in again (refreshing `last_sign_in_at`) and calls the `delete-account`
   Edge Function (`supabase/functions/delete-account`), which takes the user only from the
   token, requires the phrase and a sign-in under 10 minutes old, empties and verifies
   `vpisnice/<uid>/`, then deletes the Auth user (the step 1 trigger does the rest). It
   answers 200, 410 (already deleted), 400, 401 (`reauth_required` / `session_expired`) or
   500 (`partial_failure`; safe to re-run), logs only the outcome and a request id, and
   writes `deletion_register` (migration `20261014000300`). The page then signs out, clears
   cached data and opens `/login?deleted=1`. Shared rules live in
   `supabase/functions/_shared/account-deletion.ts`.
5. **Retention jobs**: purge closed-report evidence after 12 months, conversations whose
   participants have all deleted their accounts, and logs after 90 days.

Once migration `20261014000000` is applied, operators may delete any account through the
dashboard after emptying its `vpisnice` folder (see `docs/operations/privacy-procedures.md`).

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

| Data category                    | Approved behavior                                | Detail                                                                                                                                                                                                                                                                                                                                                       | Approval            |
| -------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------- |
| Supabase Auth user               | Permanently delete                               | Re-authentication is required when the last sign-in is older than 10 minutes. An expired session returns "sign in again"; an already-deleted account returns a clear already-deleted result. The e-mail is kept only in the safety identity record (row below).                                                                                              | Approved            |
| `profiles`                       | Scrub into a tombstone                           | The row keeps only its random id and `deleted_at`; name, age, faculty, bio, photo, availability and verification are cleared. Other users see "Izbrisan uporabnik" wherever the profile was referenced. The tombstone is removed by the retention job once nothing refers to it.                                                                             | Approved            |
| Safety identity record           | Keep, database owner only                        | E-mail and name of a deleted user, for 30 days after deletion, or 12 months after the last report about them closes if longer. No in-app access; each owner lookup is logged.                                                                                                                                                                                | Approved 2026-10-13 |
| `questionnaire_answers`          | Delete                                           | Nothing is retained.                                                                                                                                                                                                                                                                                                                                         | Approved            |
| Owned listings                   | Delete                                           | Deleting a listing also removes it from other users' favorites (existing cascade).                                                                                                                                                                                                                                                                           | Approved            |
| Favorites                        | Delete                                           | The user's own favorites rows are deleted.                                                                                                                                                                                                                                                                                                                   | Approved            |
| Matches                          | Keep, anonymized                                 | The match stays for the other participant, with the deleted user shown as "Izbrisan uporabnik".                                                                                                                                                                                                                                                              | Approved            |
| Messages                         | Keep in the other participant's chat, anonymized | Messages linked to a report are retained, anonymized, for 12 months after the report is closed. Unreported conversations are deleted once all participants have deleted their accounts. The database owner (project owner, via Supabase) can read all messages. In-app admins can read only conversations linked to a report, and every such read is logged. | Approved            |
| User reports                     | Keep, anonymized                                 | Reports made by or about the user are kept, anonymized, for 12 months after the report is closed, then deleted.                                                                                                                                                                                                                                              | Approved            |
| Academic documents in `vpisnice` | Delete immediately                               | Every object under the user's UUID folder is enumerated and deleted, then verified.                                                                                                                                                                                                                                                                          | Approved            |
| Backups                          | Expire after 30 days                             | Deleted data can remain in backups for up to 30 days. If a backup is restored, every deletion recorded since the backup date is re-applied before the service reopens.                                                                                                                                                                                       | Approved            |
| Logs/analytics                   | Minimal fields, 90 days                          | Keep only the request id, date and outcome; never passwords, tokens, document contents or message text. Deleted after 90 days.                                                                                                                                                                                                                               | Approved            |
| Admin access to messages         | Reported conversations only                      | Database owner: full access through Supabase for operations and abuse handling. In-app admins: only conversations linked to a report, with an audit record for every read. The privacy notice discloses this.                                                                                                                                                | Approved            |
| Admin message-read audit log     | Keep 12 months                                   | One row per admin read of a reported conversation (admin id, report id, time); append-only; admins can review it. Deleted 12 months after the read, like reports.                                                                                                                                                                                            | Approved 2026-10-12 |

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

Checked items are implemented and covered by unit/static tests; none has been verified on a
staging project yet (`integration/deletion.int.ts` and `integration/rls.int.ts` are written for it).

- [x] `/profile` exposes a clearly labelled deletion action for an authenticated user.
- [x] The flow explains immediate deletion, retained data, backup delay, and irreversibility.
- [x] Explicit confirmation is required and failed confirmation makes no deletion request.
- [x] The backend derives the target identity from the verified session.
- [x] Deletion executes through a trusted backend boundary with no browser service-role credential.
- [x] Every data category follows an approved retention-matrix decision.
- [x] All user-owned `vpisnice` Storage objects are explicitly deleted.
- [x] Successful deletion signs the user out, clears cache/query state, and blocks protected access.
- [x] Repeated requests are safely idempotent or return a clear already-deleted/expired result.
- [x] Partial failure is explicit, redacted, logged, and recoverable by operators.
- [ ] RLS and private Storage policies reject cross-user access before and after deletion.
- [x] Admin procedures cover retained reports/messages, anonymization, backups, restoration, and document access.
- [ ] Development, staging, and production procedures are documented and tested.
- [x] ~~Android transition behavior is verified and documented.~~ Not required: on 2026-10-13 the owner made the web the priority and Android no longer a constraint. Android's direct report insert is refused since `20261014000100`.

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
