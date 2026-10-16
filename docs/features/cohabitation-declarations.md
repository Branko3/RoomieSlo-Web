# Cohabitation declarations ("Živiva skupaj")

- Status: Blocked
- Date: 2026-10-16 (plan approved by Branko, the data controller, 2026-10-16)
- Web surfaces: `/chats/[matchId]` (declare action, confirm banner, active chip), `/chats` (attention mark), `/profile` ("Moje sobivanje"), Postgres table `cohabitations` with RLS and three RPCs
- Android behavior preserved: no longer a requirement (owner decision 2026-10-13: the web is the priority). Android has no cohabitation screens. Its existing flows are not affected: the migration adds a table, a trigger on `blocks` inserts, and one step each to the deletion trigger and the retention job.
- Plan: [`docs/nontechnical/cohabitation-and-ratings.md`](../nontechnical/cohabitation-and-ratings.md), Part A (§3, §5 `cohabitations`, §6, §7 steps 1–2). Ratings (Part B) are not part of this record.

## Behavior

1. **Declare.** In an accepted chat, either participant chooses "Živiva skupaj" and picks the move-in month. Allowed months run from the month the match was created to the current month (Slovenian time). The other person must confirm. The picker says that only the two of them can see the cohabitation.
2. **Confirm.** The other person sees the banner "<Ime> pravi, da živita skupaj od okt. 2026." with **Potrdi** and **Ne drži**. On `/chats`, that conversation shows "Čaka na tvoj odgovor o sobivanju". While waiting, the declarer sees "Čakamo, da <Ime> potrdi …".
3. **Decline.** "Ne drži" closes the declaration. The declarer sees "Ni potrjeno", with no reason. They can't declare again in that chat for 30 days, and the chat shows the date from which they can ("Znova lahko predlagaš od 15. 11. 2026 dalje."). The person who declined can declare at any time.
4. **Active.** Both see the chip "Živita skupaj od okt. 2026" and the action "Ne živiva več skupaj".
5. **End.** Either person ends it alone by picking an end month, from the move-in month to the current month. There is no reason field. After that, a new declaration is possible.
6. **One open declaration per match.** A second pending or active declaration is refused (a unique index and the RPC check).
7. **Visibility.** Only the two participants can read a cohabitation. It is not shown on profiles, in recommendations or search, or to in-app admins. Only the database owner can see it, through Supabase.
8. **"Moje sobivanje" on `/profile`.** This section lists the user's pending, active and ended cohabitations, with the other person, the state, the months and a link to the chat. Declined declarations are not listed. When a cohabitation is active and "Iščem sostanovalca / sobo" is on, the section suggests turning it off once: "Izklopi" or "Ne zdaj". Availability never changes on its own. Which suggestions were shown is stored in this browser only (`localStorage`). If storage is unavailable, the suggestion can reappear on a later visit.
9. **Block.** A new block in either direction turns pending declarations between the pair into `declined`. Active ones stay, and either person can still end them. While I block the other person, the chat offers neither "Živiva skupaj" nor "Potrdi". If the other person blocked me, the server refuses with a permission message. A decline caused by a block also starts the declarer's 30-day cooldown, and the declarer sees the same "Ni potrjeno", so the block is not revealed.
10. **Account deletion.** Pending declarations become `declined`, and active ones become `ended` with the current month. The rows stay, so the other person's history stays correct.
11. **Retention.** Cohabitations are kept while either participant's account exists, and the daily job deletes them once both are tombstones (retention matrix row, approved 2026-10-16).

States handled in the UI:

- loading;
- load error with "Poskusi znova";
- offline ("Ni povezave …");
- permission refused;
- signed out (link to `/login`);
- conflict (the state changed meanwhile: the message is shown and the data is reloaded);
- cooldown and an invalid month.

The month pickers are labelled `<select>` elements that receive focus when opened. Escape or "Prekliči" closes them and returns focus to the action. Results are announced through a `role="status"` region, and errors use `role="alert"`. The copy is gender-inclusive ("Živita", "Čakamo, da … potrdi", "se prijavi").

## Acceptance criteria

- [x] A participant of an accepted match can declare with a move-in month that is not in the future and not before the match's creation month.
- [x] Only the other participant can confirm or decline; the initiator can't (RPC check, 42501).
- [x] Either participant can end an active cohabitation alone with an end month.
- [x] At most one pending or active declaration per match; a 30-day cooldown for the same declarer after a decline.
- [x] Only the two participants can read a cohabitation; no write policies, and all writes go through the RPCs.
- [x] A block declines pending declarations; active ones stay and can still be ended.
- [x] Account deletion declines pending declarations and ends active ones with the current month; `handle_deleted_user` keeps every previous step.
- [x] `purge_expired_data` deletes cohabitations once both participants are tombstones and keeps every previous rule and counter.
- [x] Chat banner, active chip, "Ni potrjeno", chat list attention mark, and "Moje sobivanje" with a one-time availability suggestion.
- [ ] Verified on a staging project with two users (blocked: no staging project).
- [ ] Checked by hand in a browser.

## Implementation

- `supabase/migrations/20261016000000_cohabitations.sql` (forward-only):
  - `public.cohabitations`, as in plan §5:
    - `user_id_a`/`user_id_b` are copied from the match;
    - months are stored as first-of-month `date`s;
    - checks: the initiator is a participant, `ended_month >= started_month`, and `ended_month` is set exactly when the status is `ended`;
    - the partial unique index `cohabitations_one_open_per_match` (`where status in ('pending', 'active')`).
  - RLS: only `cohabitations_select_participants` (`auth.uid() = user_id_a or auth.uid() = user_id_b`). There are no insert, update or delete policies. `revoke all` from `anon` and `authenticated`, then `grant select` to `authenticated`.
  - RPCs (`security definer`, `set search_path = public`, `revoke all … from public, anon`, `grant execute … to authenticated`):
    - `declare_cohabitation(p_match_id, p_started_month)`;
    - `respond_cohabitation(p_id, p_confirm)`;
    - `end_cohabitation(p_id, p_ended_month)`.

    Each one checks explicitly that:
    - the caller is signed in and a participant;
    - the match is accepted;
    - neither profile is deleted (`is_deleted_profile`);
    - no block exists, for declare and confirm only (`is_blocked_between`);
    - the month rules hold;
    - only the non-initiator responds;
    - the state is still pending or active;
    - the cooldown has passed.

    Each change bumps `version`. Error codes:
    - `42501`: authorization;
    - `22023`: month rules;
    - `23505`: a second open declaration;
    - `P0001`: the cooldown (the message contains "cooldown"), or a state that changed meanwhile.

  - `cohabitation_current_month()`: the month in `Europe/Ljubljana`, shared by the RPCs and the deletion trigger. It is not callable through the API.
  - Trigger `decline_cohabitations_on_block` (`after insert on public.blocks`).
  - `handle_deleted_user`: the full body from `20261014000000`, plus the decline and end steps before the tombstone scrub.
  - `purge_expired_data`: the full body from `20261014000400`, plus the deletion of cohabitations whose participants are both tombstones (before the conversation rule) and a new `cohabitations` counter. A tombstone is also kept while a cohabitation refers to it. The pg_cron schedule is unchanged.
- `lib/cohabitation/months.ts`: helpers for first-of-month dates in Slovenian time; labels like "okt. 2026" and "15. 11. 2026"; the move-in and end month rules; the picker options.
- `lib/cohabitation/cohabitation.ts`: a framework-free module with:
  - the structural client;
  - `loadMatchCohabitations`, `loadMyCohabitations`, `declareCohabitation`, `respondCohabitation` and `endCohabitation`;
  - row validation (`parseCohabitation`);
  - error mapping (`toCohabitationError`, with the kinds signed-out, permission, offline, conflict, cooldown, invalid-month and unknown);
  - the chat view model (`chatCohabitationView`), `cooldownUntil`, `awaitingMyAnswer`, and the copy.
- `components/chat-cohabitation.tsx`, rendered under `ChatSafetyControls` in accepted chats. `components/cohabitation-queries.ts` holds the shared TanStack Query keys. All views share the `["cohabitations"]` prefix and are invalidated after every change and every conflict.
- `components/match-requests-panel.tsx`: the attention mark. If loading it fails, only the mark is hidden.
- `components/my-cohabitations-section.tsx` on `/profile`.
- `lib/chat/conversation.ts` now also returns `matchCreatedAt`, which bounds the move-in month picker.

## Testing contract

- Static migration checks (`tests/cohabitation-migration.test.ts`):
  - the table, the index and RLS;
  - that no write policies or write grants exist;
  - every RPC check and error code;
  - the block trigger;
  - that `handle_deleted_user` and `purge_expired_data` still contain every statement and counter of their previous definitions;
  - that no other migration touches the table.
- Unit tests (`tests/cohabitation.test.ts`, `tests/cohabitation-months.test.ts`):
  - month rules, including the time-zone edges and year boundaries;
  - the cooldown;
  - error mapping;
  - response validation;
  - the load and RPC calls;
  - the chat view model and the copy.
- Component tests:
  - `tests/components/chat-cohabitation.test.tsx`:
    - declare, with focus and Escape;
    - confirm and decline;
    - "Ni potrjeno" and the cooldown;
    - ending;
    - the blocked pair;
    - permission and conflict errors;
    - offline with retry, and signed out.
  - `tests/components/my-cohabitations-section.test.tsx`: the list, the empty state, the one-time suggestion, dismissal, and errors.
  - `tests/components/match-requests-panel.test.tsx`: the attention mark.
- Integration (staging, `integration/cohabitation.int.ts`):
  - both participants read the declaration;
  - the initiator can't confirm it (42501);
  - a second open declaration is refused (23505);
  - direct insert, update and delete are refused;
  - a third party (the admin test account) sees nothing and can't respond or declare;
  - confirm, then end by the other person.

  The suite leaves an `ended` row and never a declined one, so user A is never in a cooldown and the suite can run again.

## Handoff to testing

- Apply the migration on staging after `20261015000000`, then run `npm run test:integration`. Set `SUPABASE_TEST_ADMIN_*` to include the third-party check.
- Manual browser check with two accounts:
  - declare, confirm, end;
  - declare and decline, and check the cooldown text;
  - block during a pending declaration;
  - delete one account with an active cohabitation, and check the other person's "Moje sobivanje";
  - the availability suggestion;
  - keyboard only, and a screen reader on the banner.

## Blocker

There is no staging Supabase project, so the migration has not been applied or executed anywhere. The integration suite is written and skips itself without `SUPABASE_TEST_*`.

## Follow-ups (not in this scope)

- Ratings (plan Part B, §4) and their policy steps, including the LIA, the `/privacy` text and the dialog sentence about rating after two months.
- The self-service data export (`lib/privacy/export.ts`) does not include cohabitations yet. Plan §6 lists them under the access right, together with ratings in delivery step 5.

## Test status

- Automated status: Partially covered
- Test files: `tests/cohabitation-migration.test.ts`, `tests/cohabitation.test.ts`, `tests/cohabitation-months.test.ts`, `tests/components/chat-cohabitation.test.tsx`, `tests/components/my-cohabitations-section.test.tsx`, `tests/components/match-requests-panel.test.tsx`, `tests/conversation.test.ts`, `integration/cohabitation.int.ts`
- Scenarios covered: listed above. The unit, static and component tests pass. The integration suite is skipped without staging.
- Remaining gaps: the staging run and a manual browser check
- Manual testing: Not run unless explicitly requested
