# Report/block chat controls

- Status: Partially implemented
- Date: 2026-10-11
- Web surfaces: the conversation on `/chats/[matchId]` (`components/chat-safety-controls.tsx`), `lib/chat/blocking.ts`, `supabase/migrations/20261011000000_user_blocks.sql`
- Android behavior preserved: Android has no block or report controls in chat. This is a web addition; it does not change any Android flow, and Android clients are also bound by the new RLS conditions (a blocked pair cannot insert messages or match requests from any client).

## Behavior

- Under the conversation header, the other person can be reported or blocked:
  - **"Prijavi"** links to `/report/<userId>?from=chat&match=<matchId>`. The report form itself is the separate "Report user/listing" feature, so the link has no page yet.
  - **"Blokiraj"** first asks for confirmation in an inline panel ("Blokiraj to osebo? …") with "Prekliči" and "Blokiraj".
  - **"Odblokiraj"** is shown instead while I have blocked the person.
- While I have blocked the person, the composer is replaced by a notice: "Blokiral(a) si to osebo. Sporočil si ne moreta pošiljati, dokler je ne odblokiraš." History stays readable.
- Blocking someone already blocked counts as success. Blocking oneself is refused without a request.
- Errors use safe Slovenian copy: offline ("Ni povezave. Poskusi znova."), signed out, or a generic failure. Raw database errors are never shown.
- **Authorization is in the database, not the UI:**
  - the new `public.blocks` table has RLS so users see, create and delete only their own blocks;
  - whether someone blocked you is not revealed, only its effect;
  - `messages_insert` and `matches_insert` now also require `not public.is_blocked_between(...)` in either direction.

## Acceptance criteria

- [x] Users can block the other chat participant after confirmation, and unblock them.
- [x] A block in either direction prevents new messages and new match requests (RLS).
- [x] The blocked state is visible and the composer is disabled for the blocker.
- [x] Users can start a report from the conversation.
- [ ] The report flow completes (depends on the "Report user/listing" feature; `/report/[userId]` does not exist yet).
- [ ] The person who was blocked sees a clear notice. Today their send fails with the generic "Ni poslano" state, because RLS refuses the insert without saying why.
- [ ] The migration is applied and verified with negative-access tests (blocked: no staging project or Supabase CLI).

## Implementation

- `supabase/migrations/20261011000000_user_blocks.sql`:
  - `public.blocks(blocker_id, blocked_id, created_at)` with a composite primary key, a "not yourself" check, cascade on profile delete, and an index on `blocked_id`;
  - policies `blocks_select_own`, `blocks_insert_own`, `blocks_delete_own` (no update policy);
  - `public.is_blocked_between(a, b)`, a `security definer` function with a fixed `search_path`, executable only by `authenticated`, so policies can check both directions without exposing other users' rows;
  - **recreates `messages_insert` and `matches_insert`** with their previous conditions plus the block check.
- `lib/chat/blocking.ts`:
  - `hasBlocked`, `blockUser`, `unblockUser` over a structural `BlockClient`;
  - `BlockError` with the kinds `signed-out`, `self`, `offline`, `failed`;
  - `reportHref`.
- `components/chat-safety-controls.tsx`:
  - `useBlockState(peerId)`, using TanStack Query key `["block", peerId]`;
  - `ChatSafetyControls`.
- `app/chats/[matchId]/page.tsx` renders the controls and swaps the composer for the notice when blocked.
- **Stacked on PR #47** (→ #46 → … → #40): this branch starts from `agent/message-deduplication-and-rollback`.

## Testing contract

- Unit:
  - the query shapes of `hasBlocked`, `blockUser` and `unblockUser` are scoped to the current user;
  - an existing block counts as success, and blocking oneself is refused without a request;
  - error mapping covers signed-out, offline and failed;
  - `reportHref` encodes its parameters;
  - static checks on the migration: RLS enabled, own-row policies only, the security definer function locked down, and the block check present in both recreated policies.
- Integration (staging):
  - A blocks B, then neither can insert a message or a match for the other;
  - B cannot read A's block row;
  - after unblocking, messages work again.
- End-to-end: block from the conversation, see the notice, unblock.
- Manual: none beyond the above.

## Handoff to testing

Unit scenarios above; RLS negative-access tests and the two-session browser flow once staging exists.

## Test status

- Automated status: Partially covered
- Test files: `tests/blocking.test.ts`
- Scenarios covered: all unit scenarios, 13 tests, passing with `npm run test`.
- Remaining gaps:
  - the migration has not been executed against a database;
  - the component and hook are not tested (no React Testing Library/jsdom);
  - no two-session or browser run.
- Manual testing: Not run unless explicitly requested
