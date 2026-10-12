# Reconnect with bounded backoff

- Status: Implemented
- Date: 2026-10-11
- Web surfaces: the live connection of an open conversation on `/chats/[matchId]` (`components/use-message-realtime.ts`), `lib/chat/reconnect.ts`
- Android behavior preserved: `ChatRealtimeService` retries a failed subscription after 1, 2, 4, 8, 16 and then 30 seconds (`OSNOVNI_ODLOG_MS = 1000`, doubled per attempt, `NAJVECJI_POMIK = 5`, capped at `NAJVECJI_ODLOG_MS = 30000`). The counter is local to one conversation and resets once the subscription succeeds.

## Behavior

- When the live channel reports `CHANNEL_ERROR`, `TIMED_OUT`, or `CLOSED`, the broken channel is removed and a new subscription is attempted after 1 s, then 2, 4, 8, 16, and 30 s for every later attempt. The page shows "Povezava v živo je prekinjena. Ponovni poskus čez N s."
- When a reconnect succeeds, the counter resets and the message history is refetched so anything sent during the outage appears (de-duplicated by id). The first connection does not refetch.
- When the browser comes back online (`online` event), the remaining wait is skipped and the app reconnects at once.
- When the tab is hidden, everything stops: no channel and no pending retries. When it becomes visible, the app reconnects at once and refetches the history.
- Repeated failure reports from the same channel schedule only one retry, and events from an old channel are ignored. A channel that fails synchronously while connecting is cleaned up and retried.

## Acceptance criteria

- [x] Failed or dropped subscriptions reconnect automatically with Android's bounded backoff (1, 2, 4, 8, 16, 30 s cap).
- [x] The backoff resets after a successful reconnect.
- [x] Missed messages are reconciled after every reconnect.
- [x] No retries run in hidden tabs; returning or coming online reconnects immediately.
- [x] Only one connection exists at a time, and stale channel events are ignored.
- [x] The user sees when the next retry happens.
- [ ] Verified against a real Supabase Realtime outage in a browser (blocked: staging credentials and installed browsers).

## Implementation

- `lib/chat/reconnect.ts`:
  - `backoffDelay(attempt)`,
  - `createReconnectingSubscription({ connect, onReconnected, onState, timer })` with `start`, `pause`, `resume`, `retryNow`, and `attempts`. The timer is injectable for tests. A per-connection token makes statuses reported synchronously during `connect` safe.
- `components/use-message-realtime.ts` — uses the controller around `subscribeToMessages` (PR #45), handles visibility and `online`, and returns `{ state, retryInMs }`; `liveNotice` builds the copy.
- `app/chats/[matchId]/page.tsx` — shows the notice for `waiting` and `disconnected`.
- **Stacked on PR #45** (→ #44 → #43 → #42 → #41 → #40): this branch starts from `agent/supabase-realtime-subscription`. Once those merge, this PR's diff reduces to the files above.

## Testing contract

- Unit: the delay sequence and cap; odd inputs; first connect without reconciliation; seven consecutive failures following 1–30 s; reset and reconciliation after recovery; the broken channel closed before retry; duplicate and stale reports ignored; synchronous failure while connecting; pause clears timers and the connection and ignores later events; resume reconnects at once with reconciliation; `retryNow` skips the wait; no second connection while one is active; notice copy. Implemented with a manual timer and fake connections.
- Integration: a staging project with Realtime interrupted.
- End-to-end: in DevTools go offline, then online, and see the retry notice and recovery; send from another session during the outage and see the message after reconnecting.
- Manual: none beyond the above.

## Handoff to testing

All unit scenarios above; browser checks for the notice, offline/online, and hidden-tab behavior.

## Test status

- Automated status: Partially covered
- Test files: `tests/reconnect.test.ts`
- Scenarios covered: all unit scenarios (13 tests, passing with `npm run test`).
- Remaining gaps: the hook is not component-tested (no React Testing Library/jsdom); no real Realtime outage in a browser.
- Manual testing: Not run unless explicitly requested
