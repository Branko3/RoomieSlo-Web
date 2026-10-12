# RoomieSlo privacy operations

How operators handle data-subject requests, account deletion, retention and personal-data
incidents for the web app and the shared Supabase project.

The retention matrix, which data is kept and for how long after deletion, was **approved on
2026-10-12** and lives in `docs/features/account-document-deletion-retention-rules.md`. That
record is the single policy source; these procedures apply it and don't set periods of their own.

Values in angle brackets (`<…>`) are owner decisions; see [Open decisions](#open-decisions).

## 1. Requests and deadlines

| Request (GDPR)                        | How users make it                                                                        | Who handles it           | Deadline                              |
| ------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------- |
| Access / portability (Art. 15, 20)    | Self-service: `/privacy` → "Prenesi podatke" (JSON). Academic document files on request. | User; operator for files | Immediate; files within 1 month       |
| Rectification (Art. 16)               | Edit the profile, or "Zahtevaj popravek" (email)                                         | User; operator           | 1 month                               |
| Erasure / account deletion (Art. 17)  | "Zahtevaj izbris" (email to `NEXT_PUBLIC_PRIVACY_CONTACT`)                               | Operator (section 3)     | 1 month (extendable by 2 with notice) |
| Objection / restriction (Art. 18, 21) | Email                                                                                    | Operator and owner       | 1 month                               |

Log every request in `<request log>`: date received, account id, type, identity check, actions and
date closed. Store no copies of the user's data in the log.

## 2. Identity verification

- Accept requests only from the email address on the account (Supabase Auth → Users), or from a signed-in session for self-service.
- Never act on an account id supplied in the email body alone. Match it against the sender's account.
- If the email doesn't match, reply asking the user to send the request from the account's address. Do not confirm whether an account exists.

## 3. Account deletion procedure (operator)

There's no self-service deletion yet (Android has none; it is follow-up work in the retention
record). Operators delete accounts manually in the Supabase dashboard of the **production**
project, with two people where possible.

1. **Verify** the request (section 2) and record it.
2. **Check open safety cases:** in `/admin/reports`, or with the SQL editor `select id, status from reports where reported_id = '<uid>' and status = 'open'`.
   - If there are open reports about this user, finish reviewing them first. Reports are kept, anonymized, for 12 months after closing (approved matrix).
3. **Delete academic documents:** Storage → `vpisnice` → folder `<uid>/` → select all → delete.
   - This is mandatory: database deletion does **not** remove Storage files.
   - Confirm the folder is empty.
4. **Delete the Auth user:** Authentication → Users → the user → Delete user. Through `on delete cascade` this removes:
   - their `profiles` row;
   - `questionnaire_answers`, owned `listings` (and other users' favorites of them) and `favorites`;
   - `matches` they took part in, and every message in those matches, including the other participant's;
   - reports they filed or that name them.

   **This contradicts the approved matrix**, which keeps matches, messages and reports for the other participant (anonymized). Until the cascade migration from the retention record lands:
   - if the user has **no** matches and is named in **no** reports, run this step as written;
   - otherwise, do steps 3 and 5's document check, delete the user's `questionnaire_answers`, `favorites` and owned `listings` in the SQL editor, record the request as "awaiting migration", and finish this step only after the migration is applied. Tell the user what was deleted and when the rest will follow, within the one-month deadline (extendable by two months under GDPR art. 12(3) with a reason).

5. **Verify** in the SQL editor that each count is 0:

   ```sql
   select
     (select count(*) from profiles where id = '<uid>') as profiles,
     (select count(*) from listings where owner_id = '<uid>') as listings,
     (select count(*) from matches where user_id_a = '<uid>' or user_id_b = '<uid>') as matches,
     (select count(*) from storage.objects where bucket_id = 'vpisnice' and name like '<uid>/%') as documents;
   ```

6. **Backups:** deleted data remains in backups until they expire (30 days, approved matrix; see the runbook's section 4). If a backup is ever restored, re-apply all deletions recorded in the request log since the backup date before reopening the service.
7. **Reply** to the user confirming deletion and the backup-expiry date. Close the log entry.

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
- Decided 2026-10-12 (retention record): backup retention 30 days; the full retention matrix; admin message access limited to reported conversations. Still to build: the cascade migration, report evidence, the admin message view with audit log, and self-service deletion.
