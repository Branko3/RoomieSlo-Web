# Chat and match authorization

- Status: Blocked
- Date: 2026-10-13
- Web surfaces: Postgres RLS on `matches` and `messages`, `accept_match` RPC; used by `/chats`, `/chats/[matchId]` and the listing request panel
- Android behavior preserved: Android answers a request with `update matches set status … where id = … and status = 'pending'` as the recipient, sends messages only in accepted chats, and updates only `delivery_status` of the other person's messages (`markDelivered`, `markRead`). All of these keep working. A requester who tries to answer their own request now gets zero updated rows, which Android already reports as a conflict.

## Behavior

Closes three open security items listed in the review log and the remaining-work plan:

1. **Self-accept.** `matches_update` and `accept_match` allowed either participant, so the requester could accept their own request. Now only the recipient (`user_id_b`) can answer, and only while the request is `pending`.
2. **Messages in unaccepted matches.** `messages_insert` checked only participation and blocks. It now also requires `matches.status = 'accepted'`.
3. **Rewriting the other person's message.** `messages_update` let either participant change any column. Now only the recipient (`sender_id <> auth.uid()`) can update, and a trigger lets API callers change only `delivery_status`, never backwards (`sent → delivered → read`).

A `reject_match` RPC was considered and not added: rejection is a single conditional update that the new policy already restricts to the recipient, and both the web and Android use that path.

## Acceptance criteria

- [x] Only the recipient can accept or reject a pending request (policy and RPC).
- [x] API callers can change only `matches.status`; `version` is bumped by the database on every answer.
- [x] Messages can only be inserted in an accepted match, as the sender, without a block.
- [x] Only the recipient can update a message, only its `delivery_status`, and only forwards.
- [ ] Verified on a staging project with two users (blocked: no staging project).

## Implementation

- `supabase/migrations/20261013000000_chat_and_match_authorization.sql` (forward-only):
  - `matches_update`: `using (auth.uid() = user_id_b and status = 'pending')`, `with check (auth.uid() = user_id_b and status in ('accepted', 'rejected'))`.
  - `guard_match_update` trigger (`security definer`, only for the `authenticated` role, like #51's `protect_academic_verification`): rejects changes to `id`, `user_id_a`, `user_id_b`, `created_at` with `42501`; sets `version = old.version + 1` when the status changes.
  - `accept_match`: repeats the recipient check, because RLS does not apply inside a `security definer` function. The version bump moved to the trigger.
  - `messages_insert`: adds `m.status = 'accepted'`, keeps the #48 block check.
  - `messages_update`: recipient-only in `using` and `with check`.
  - `guard_message_update` trigger: rejects changes to `id`, `match_id`, `sender_id`, `body`, `sent_at`, and any backwards status move, with `42501`.
- No web code change was needed: `respondToMatch` already filters `user_id_b = me`, the composer is only shown in accepted chats, and `markRead`/`markDelivered` only touch the other person's messages.

## Testing contract

- Unit: static SQL checks of the effective policies, functions and triggers after all migrations.
- Integration (staging): requester cannot accept their own request (RPC error, zero rows on direct update); recipient can mark a message read but not move it back; sender cannot change their own message's status; the existing "rewrite the other person's message" test now passes.
- End-to-end: none new (no UI change).

## Handoff to testing

- Apply the migration on staging after `20261011000100`, then run `npm run test:integration`.
- Android manual check on staging: send a request, accept it as the recipient, chat, and check the delivered/read ticks still update.

## Blocker

No staging Supabase project, so the migration has not been applied or executed anywhere. The integration tests are written and skip without `SUPABASE_TEST_*`.

## Test status

- Automated status: Partially covered
- Test files: `tests/chat-match-authorization.test.ts`, `integration/rls.int.ts`, `integration/realtime.int.ts`, `integration/clients.ts`
- Scenarios covered: static policy/function/trigger checks (7 tests, passing); 3 new staging scenarios plus the shared `ensureAcceptedMatch` setup (skipped without staging)
- Remaining gaps: execution on staging; Android manual check
- Manual testing: Not run unless explicitly requested
