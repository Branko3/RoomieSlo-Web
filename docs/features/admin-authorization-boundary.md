# Admin authorization boundary

- Status: Partially implemented
- Date: 2026-10-11
- Web surfaces:
  - `supabase/migrations/20261011000100_admin_authorization_boundary.sql` (database only; no UI change);
  - the `/admin/reports` UI guard is in PR #50.
- Android behavior preserved:
  - Android's admin check (`AdminRepository.isAdmin` reads the user's own `admins` row), report listing and status updates keep working unchanged;
  - Android profile saves that send `academic_status_verified` are not rejected. The value is kept as it was for non-admins, which also stops a stale `false` from un-verifying a profile.

## Behavior

RLS and grants, not the web UI, decide what an admin can do:

- **`public.is_admin()`:**
  - a `security definer` function with a fixed `search_path`, executable only by `authenticated`;
  - `reports_admin_select` and `reports_admin_update` now use it;
  - `reports_admin_update` gains an explicit `with check`.
- **Admin membership can't be changed through the API:**
  - `insert/update/delete/truncate` on `admins` are revoked from `anon` and `authenticated`, so even a policy added by mistake can't grant admin rights;
  - users can still read only their own row (`admins_self_select`).
- **Reports:**
  - admins may update only the `status` column (column-level grant), so they cannot rewrite reporter, target, reason or description;
  - delete and truncate are revoked;
  - inserts stay tied to `auth.uid() = reporter_id`.
- **Academic verification is an admin decision:**
  - a `before insert or update` trigger on `profiles` keeps `academic_status_verified` unchanged for signed-in non-admins, and forces it to `false` on insert;
  - service role, SQL and the signup trigger are unaffected;
  - this closes the self-verification gap noted in PR #20.
- The web never uses the service role and never writes to `admins`. This is enforced by a test over `app/`, `lib/` and `components/`.

## Acceptance criteria

- [x] RLS remains the security boundary for every admin capability, whatever the UI shows.
- [x] Non-admins cannot become admins, read reports, or change report status through the API.
- [x] Admin updates are limited to what the dashboard needs (`status`).
- [x] Non-admins cannot verify their own academic status.
- [ ] Negative-access tests are run against a real database (blocked: no staging project or Supabase CLI).

## Implementation

- Migration `20261011000100_admin_authorization_boundary.sql`, which comes after #48's `20261011000000_user_blocks.sql`:
  - the `is_admin()` helper;
  - grant and privilege revokes;
  - recreated report policies;
  - the `protect_academic_verification` trigger.
- No application code changes. #50's dashboard already updates only `status`, so it is compatible with the column grant.

## Testing contract

- Unit (static SQL checks; not executed):
  - the migration runs after the baseline;
  - `is_admin()` is a locked-down security definer function;
  - the effective policies on `admins` are self-select only, and its write privileges are revoked;
  - the effective policies on `reports` are insert (reporter), select and update (admin, `using` and `with check`), with no delete;
  - only the `status` column is granted for update;
  - the verification trigger preserves rather than raises, and covers insert and update;
  - the web never uses `service_role` and never writes to `admins`.
- Integration (staging, required before release):
  - a non-admin cannot insert into `admins`, select reports, or update report status (0 rows);
  - an admin can update `status` but not `reason`;
  - a non-admin's `update profiles set academic_status_verified = true` leaves it `false`;
  - Android's full-row profile save still succeeds.
- End-to-end: none (no UI).
- Manual: none beyond the above.

## Handoff to testing

Run the staging negative-access cases above with one admin and one regular account.

## Test status

- Automated status: Partially covered
- Test files: `tests/admin-authorization.test.ts`
- Scenarios covered: all static checks, 10 tests, passing with `npm run test`.
- Remaining gap: the SQL has not been executed, so no negative-access run on a database.
- Manual testing: Not run unless explicitly requested
