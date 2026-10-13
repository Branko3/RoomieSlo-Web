# RoomieSlo privacy operations

How operators handle data-subject requests, account deletion, retention and personal-data
incidents for the web app and the shared Supabase project.

The retention matrix, which data is kept and for how long after deletion, was **approved on
2026-10-12** and lives in `docs/features/account-document-deletion-retention-rules.md`. That
record is the single policy source; these procedures apply it and don't set periods of their own.

Values in angle brackets (`<…>`) are owner decisions; see [Open decisions](#open-decisions).

## 1. Requests and deadlines

| Request (GDPR)                        | How users make it                                                                        | Who handles it                                                      | Deadline                                                                |
| ------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Access / portability (Art. 15, 20)    | Self-service: `/privacy` → "Prenesi podatke" (JSON). Academic document files on request. | User; operator for files                                            | Immediate; files within 1 month                                         |
| Rectification (Art. 16)               | Edit the profile, or "Zahtevaj popravek" (email)                                         | User; operator                                                      | 1 month                                                                 |
| Erasure / account deletion (Art. 17)  | Self-service: Profil → "Izbriši račun"; or "Zahtevaj izbris po e-pošti"                  | User; operator (section 3) for e-mail requests and partial failures | Immediate; e-mail requests within 1 month (extendable by 2 with notice) |
| Objection / restriction (Art. 18, 21) | Email                                                                                    | Operator and owner                                                  | 1 month                                                                 |

Log every request in `<request log>`: date received, account id, type, identity check, actions and
date closed. Store no copies of the user's data in the log.

## 2. Identity verification

- Accept requests only from the email address on the account (Supabase Auth → Users), or from a signed-in session for self-service.
- Never act on an account id supplied in the email body alone. Match it against the sender's account.
- If the email doesn't match, reply asking the user to send the request from the account's address. Do not confirm whether an account exists.

## 3. Account deletion procedure (operator)

Users delete their own accounts on `/profile/delete-account`. Operators handle e-mail requests
and finish self-service deletions that ended in `partial_failure` (a `deletion_register` row
with that outcome: re-run this procedure for its `subject`). Operators delete accounts in the Supabase dashboard of the
**production** project, with two people where possible. The same database trigger runs for
both, so the outcome is identical.

1. **Verify** the request (section 2) and record it.
2. **Check open safety cases:** in `/admin/reports`, or with the SQL editor `select id, status from reports where reported_id = '<uid>' and status = 'open'`.
   - If there are open reports about this user, finish reviewing them first. Reports are kept, anonymized, for 12 months after closing (approved matrix).
3. **Delete academic documents:** Storage → `vpisnice` → folder `<uid>/` → select all → delete.
   - This is mandatory: database deletion does **not** remove Storage files.
   - Confirm the folder is empty.
4. **Delete the Auth user:** Authentication → Users → the user → Delete user. The
   `on_auth_user_deleted` trigger (migration `20261014000000`) then applies the approved
   matrix in the same transaction:
   - saves the e-mail and name in `deleted_user_safety_records` (database owner only);
   - deletes `questionnaire_answers`, `favorites`, owned `listings` (with other users'
     favorites of them), `blocks` and any admin role;
   - rejects pending match requests;
   - scrubs `profiles` into a tombstone ("Izbrisan uporabnik", empty details,
     `deleted_at` set). Matches, messages and reports stay for the other participant.

   Requests logged as "awaiting migration" before this migration: finish them with this step.

5. **Verify** in the SQL editor that the profile is a tombstone and the owned data is gone
   (`tombstone` = true, every other column 0):

   ```sql
   select
     (select deleted_at is not null and display_name = 'Izbrisan uporabnik'
        and faculty = '' and bio = '' and avatar_url = '' and age is null
      from profiles where id = '<uid>') as tombstone,
     (select count(*) from auth.users where id = '<uid>') as auth_users,
     (select count(*) from questionnaire_answers where profile_id = '<uid>') as answers,
     (select count(*) from favorites where profile_id = '<uid>') as favorites,
     (select count(*) from listings where owner_id = '<uid>') as listings,
     (select count(*) from storage.objects where bucket_id = 'vpisnice' and name like '<uid>/%') as documents;
   ```

6. **Backups:** deleted data remains in backups until they expire (30 days, approved matrix; see the runbook's section 4). If a backup is ever restored, re-apply all deletions recorded in the request log since the backup date before reopening the service.
7. **Reply** to the user confirming deletion and the backup-expiry date. Close the log entry.

### Looking up a deleted user's identity (safety cases)

A report about a deleted account shows "Izbrisan uporabnik" everywhere, including
`/admin/reports`. If a harassment case needs the person's identity (GDPR art. 17(3)(e) legal
claims, art. 6(1)(f) user safety), only the **database owner** may look it up:

```sql
select * from deleted_user_safety_records where profile_id = '<reported_id>';
```

Record every lookup in the request log with the report id and the reason. In-app admins have
no access: no policy, RPC or dashboard view reads this table. Retention: 30 days after the
deletion, or 12 months after the last report about the person closes, whichever is later
(enforced by the retention job).

## 4. Data minimisation in operations

- Logs: client error reports contain no personal data (`lib/ops/report-error.ts`). Don't add user ids, emails, message text or document names to logs or alerts.
- Admins see reports without the reporter's identity (`/admin/reports`). Report descriptions can contain personal text: read them only for moderation.
- Academic documents: only the owner and admins can read the `vpisnice` folder (RLS). Never download them to personal devices, and never attach them to tickets.
- Exports and backups are encrypted at rest, and access is limited to `<owner>`.
- Test and staging environments never contain production personal data. Use test accounts only.

## 5. Personal-data incident (breach) response

1. **Contain** using the runbook's section 5 decision guide (roll back, revoke sessions, fix RLS).
2. **Assess:** which data categories (table and bucket), how many users, the time window, and whether data left the system.
3. **Notify** the supervisory authority (Slovenia: Informacijski pooblaščenec) within **72 hours** of becoming aware, unless the breach is unlikely to result in a risk. Notify affected users without undue delay if the risk is high.
4. **Record** every incident in `<breach register>` (facts, effects, actions), even ones that aren't notified.

## 6. Retention review (quarterly)

- Check that `vpisnice` holds no folders for deleted accounts:

  ```sql
  select name from storage.objects o
  where bucket_id = 'vpisnice'
    and not exists (
      select 1 from profiles p
      where p.id::text = split_part(o.name, '/', 1)
    );
  ```

- Check that backups older than 30 days are deleted and the request log is current.
- Apply the approved periods: delete reports (and their linked message evidence) closed more than 12 months ago, conversations whose participants have all deleted their accounts, and logs older than 90 days.
- Review the admin message-access audit log: every in-app read must belong to a reported conversation.

## Open decisions

- `NEXT_PUBLIC_PRIVACY_CONTACT` (the privacy email shown on `/privacy`) and the request owner.
- Locations of the request log and breach register.
- Decided 2026-10-12 (retention record): backup retention 30 days; the full retention matrix; admin message access limited to reported conversations. Decided 2026-10-13: profile tombstones and the safety identity record (migration `20261014000000`). Still to build: report evidence, the admin message view with audit log, self-service deletion and the retention jobs.
