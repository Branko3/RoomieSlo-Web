# Supabase Realtime subscription

- Status: Implemented
- Date: 2026-10-11
- Web surfaces: an open accepted conversation on `/chats/[matchId]` (`components/use-message-realtime.ts`), `lib/chat/realtime.ts`
- Android behavior preserved: `ChatRealtimeService.observeMessages` subscribes to `postgres_changes` INSERT events on `public.messages` filtered by `match_id`, on channel `klepet-<matchId>`, and unsubscribes when the screen goes away. `ChatViewModel` appends a new message only if its id is not already in the list, and marks incoming messages as read while the chat is open. `messages` is in the `supabase_realtime` publication (baseline migration), and RLS `messages_select` decides which rows each subscriber receives.

## Behavior

- While an accepted conversation is open and the tab is visible, the page subscribes to new messages of that match. A message from the other person appears immediately, in time order, and is marked read by the read-marker from PR #44. A message already in the list (same id) is never added twice.
- UPDATE events are subscribed too (a web addition): when the other person reads my messages, "Prebrano" appears live. States only move forward.
- When the tab is hidden, the channel is removed (no idle WebSocket in background tabs). When the tab becomes visible again, the page resubscribes and refetches the history, so anything that arrived while hidden is reconciled from the server.
- Leaving the page removes the channel. Cleanup is idempotent, and events arriving after cleanup are ignored.
- If the channel reports `CHANNEL_ERROR`, `TIMED_OUT`, or `CLOSED`, a notice says "Povezava v živo je prekinjena. Nova sporočila se prikažejo, ko se povezava obnovi." Automatic reconnect with bounded backoff is the next backlog feature.
- Pending, rejected, and not-found conversations never subscribe.

## Acceptance criteria

- [x] New messages of an open conversation appear without a reload, in order and without duplicates.
- [x] Subscriptions are cleaned up on unmount and when the page is hidden, and restored (with reconciliation) when visible.
- [x] Delivery-state updates arrive live and never move backwards.
- [x] A broken connection is visible to the user.
- [x] Only accepted conversations subscribe; RLS remains the boundary for which events arrive.
- [ ] Automatic reconnect with bounded backoff (next feature, "Reconnect with bounded backoff").
- [ ] Local-vs-Realtime duplicate of my own just-sent message reconciled before confirmation (feature "Message deduplication and rollback").
- [ ] Verified with two browser sessions against Supabase Realtime (blocked: staging credentials and installed browsers).

## Implementation

- `lib/chat/realtime.ts`:
  - `subscribeToMessages(client, matchId, { onInsert, onUpdate, onStatus })` (INSERT and UPDATE filters, malformed payloads ignored, idempotent cleanup via `removeChannel`),
  - `channelName`, `toRealtimeStatus`,
  - pure cache updates `applyRealtimeInsert` (dedupe and time order) and `applyRealtimeUpdate` (forward-only).
- `components/use-message-realtime.ts` — visibility-aware subscription that refetches on return.
- `app/chats/[matchId]/page.tsx` — enables it for accepted conversations and shows the disconnected notice; `app/globals.css` — `.live-status`.
- **Stacked on PR #44** (→ #43 → #42 → #41 → #40): this branch starts from `agent/sent-delivered-and-read-states`. Once those merge, this PR's diff reduces to the files above.

## Testing contract

- Unit: channel name and filters; valid, malformed, and empty inserts; valid and invalid updates; status mapping and reporting; single cleanup that ignores later events; insert dedupe and late-event ordering; forward-only updates; unloaded history. Implemented with a fake channel.
- Integration: two sessions on a staging project (insert visible on the other side, RLS prevents foreign subscriptions).
- End-to-end: user B sends and user A sees it without reload; A hides the tab, B sends, A returns and sees it.
- Manual: none beyond the above.

## Handoff to testing

All unit scenarios above; browser checks for the visibility handling and the disconnected notice.

## Test status

- Automated status: Partially covered
- Test files: `tests/realtime.test.ts`
- Scenarios covered: all unit scenarios (17 tests, passing with `npm run test`).
- Remaining gaps: the hook is not component-tested (no React Testing Library/jsdom); no two-session Realtime run; reconnect backoff and local/Realtime reconciliation are the next features.
- Manual testing: Not run unless explicitly requested
