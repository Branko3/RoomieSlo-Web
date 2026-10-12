# Open chat after successful match request

- Status: Implemented
- Date: 2026-10-11
- Web surfaces: the request status on `/listings/[id]` (`components/match-request-button.tsx`), `lib/matching/chat-link.ts`
- Android behavior preserved: a conversation exists only for an accepted match. The chat list labels it "Sprejeto — odpri klepet" and opens the chat for that match. Pending and rejected requests have no conversation.

## Behavior

- After sending a request on a listing, the requester sees "Zahteva je poslana." with "Odpri klepete →" to the request list on `/chats`; a pending request has no conversation yet.
- While **my own** request is pending, the listing page re-checks its state every 30 seconds and when the window regains focus. As soon as the owner accepts, the status changes to "Že sta povezana…" with **"Odpri klepet →" directly to `/chats/[matchId]`**, without a reload.
- Accepted requests found when opening a listing link straight to that conversation. Pending (either direction) and rejected requests link to `/chats`.
- Nothing is polled for requests sent to me, accepted or rejected requests, my own listings, or signed-out visitors.
- On the recipient's side, accepted rows on `/chats` already link to `/chats/[matchId]` (PR #36).

## Acceptance criteria

- [x] An accepted request opens its conversation route `/chats/[matchId]` directly.
- [x] A requester waiting for an answer sees the chat link appear after acceptance without reloading.
- [x] Pending and rejected requests never link to a conversation that does not exist.
- [x] Polling is limited to the requester's own pending request.
- [ ] The conversation route `/chats/[matchId]` exists (separate Phase 5 feature "Conversation route").
- [ ] Real-time update instead of polling (Phase 5 Realtime features).
- [ ] Verified with two browser sessions (blocked: staging credentials and installed browsers).

## Implementation

- `lib/matching/chat-link.ts` — `chatHref`, `chatLinkFor`, `shouldWatchForAcceptance`, `ACCEPTANCE_POLL_MS` (30 s).
- `components/match-request-button.tsx` — `refetchInterval` and `refetchOnWindowFocus` only while watching; the link comes from `chatLinkFor`; "Zahteva je poslana." shows only while the request is still pending, so a later acceptance replaces it.
- **Stacked on PR #38** (Duplicate-request prevention): this branch starts from `agent/duplicate-request-prevention` because it changes that PR's button. Once #38 merges, this PR's diff reduces to the files above.

## Testing contract

- Unit: route encoding; links for accepted, pending, rejected, and missing requests; the watch decision for every request state; the poll interval.
- Integration: none.
- End-to-end: A sends a request, B accepts on `/chats`, and A's listing page shows "Odpri klepet →" within 30 s (or on focus) linking to the conversation.
- Manual: none beyond the above.

## Handoff to testing

All unit scenarios above; component and browser checks for polling start/stop and the link change.

## Test status

- Automated status: Partially covered
- Test files: `tests/chat-link.test.ts`
- Scenarios covered: all unit scenarios (15 tests, passing with `npm run test`).
- Remaining gaps: the polling behavior in the component is not component-tested (no React Testing Library/jsdom); no two-session run; the conversation route is a later feature.
- Manual testing: Not run unless explicitly requested
