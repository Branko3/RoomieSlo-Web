# RoomieSlo privacy operations

How operators handle data-subject requests, account deletion, retention and personal-data
incidents for the web app and the shared Supabase project.

The retention matrix itself, which data is kept and for how long after deletion, is still
**pending approval** in PR #9 (`docs/features/account-document-deletion-retention-rules.md`).
These procedures don't decide retention. Where a step depends on it, they point to the matrix and
take the most protective safe action (keep the data, restrict access) until it is approved.

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

There's no self-service deletion yet. Android has none, and the automated flow is blocked on the
retention matrix in PR #9. Until then, operators delete accounts manually in the Supabase dashboard
of the **production** project, with two people where possible.

1. **Verify** the request (section 2) and record it.
2. **Check open safety cases:** in `/admin/reports`, or with the SQL editor `select id, status from reports where reported_id = '<uid>' and status = 'open'`.
   - If there are open reports about this user, finish reviewing them first. While the report-retention row of the matrix is pending, keep a redacted note: report id, reason, outcome, no personal text.
3. **Delete academic documents:** Storage → `vpisnice` → folder `<uid>/` → select all → delete.
   - This is mandatory: database deletion does **not** remove Storage files.
   - Confirm the folder is empty.
4. **Delete the Auth user:** Authentication → Users → the user → Delete user. Through `on delete cascade` this removes:
   - their `profiles` row;
   - `questionnaire_answers`, owned `listings` (and other users' favorites of them) and `favorites`;
   - `matches` they took part in, and every message in those matches, including the other participant's;
   - reports they filed or that name them.

   This is today's schema behavior. If the approved matrix requires keeping or anonymizing messages or reports, a migration must change the cascades **before** this step is used again (tracked in PR #9).

5. **Verify** in the SQL editor that each count is 0:

   ```sql
   select
     (select count(*) from profiles where id = '<uid>') as profiles,
     (select count(*) from listings where owner_id = '<uid>') as listings,
     (select count(*) from matches where user_id_a = '<uid>' or user_id_b = '<uid>') as matches,
     (select count(*) from storage.objects where bucket_id = 'vpisnice' and name like '<uid>/%') as documents;
   ```

6. **Backups:** deleted data remains in backups until they expire (`<retention>`, see the runbook's section 4). If a backup is ever restored, re-apply all deletions recorded in the request log since the backup date before reopening the service.
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

- Check that backups older than `<retention>` are deleted and the request log is current.
- Once the PR #9 matrix is approved, apply its periods here (for example closed reports or inactive accounts).

## Open decisions

- `NEXT_PUBLIC_PRIVACY_CONTACT` (the privacy email shown on `/privacy`) and the request owner.
- Locations of the request log and breach register.
- Backup retention (shared with the runbook).
- The PR #9 retention matrix (messages, reports, listings, logs), which may require a migration before deletions continue.
- Whether to build self-service deletion (a trusted server function or Edge Function, as described in PR #9) once the matrix is approved.
