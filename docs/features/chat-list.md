# Chat list

- Status: Implemented
- Date: 2026-10-13
- Web surfaces: `/chats`, `components/match-requests-panel.tsx`, `lib/chat/delivery.ts`
- Android behavior preserved: Android's chat list (`ChatListViewModel`) is the list of the user's matches, with accept/reject for incoming requests and a chat entry for accepted ones. On every load it marks the other person's `sent` messages as `delivered` in each accepted match and ignores failures. The web now does the same.

## Behavior

- `/chats` no longer shows the hard-coded preview conversations (Iva, Marko, Sara), the fake "3 dobra ujemanja" count, or the inert "Več možnosti" button.
- The list is the existing match panel: incoming requests with Sprejmi/Zavrni, sent requests with their state, and "Odpri klepet" for accepted matches.
- After each successful load, the other person's `sent` messages in every accepted match become `delivered`, so the sender sees "Dostavljeno" before the chat is opened. A failed update never affects the list.
- The banner now links to `/recommendations` without inventing a count.

## Acceptance criteria

- [x] No preview data on `/chats`.
- [x] Accepted matches are marked delivered when the list loads (Android parity).
- [x] Pending and rejected matches are not touched.
- [x] Delivery failures never break the list.

## Implementation

- `markAcceptedDelivered(client, rows)` in `lib/chat/delivery.ts` calls the existing `markDelivered` for accepted rows only and never throws.
- `MatchRequestsPanel` runs it, without awaiting it, after `loadMyMatches`.
- Removed CSS used only by the static list (`.chat-list`, `.chat-row`, `.chat-copy`, `.chat-time`).
- Authorization is unchanged: `messages_update` (recipient-only after migration `20261013000000`) is the boundary.

## Testing contract

- Unit: `tests/delivery.test.ts`: only accepted matches are updated, no calls without accepted matches, failures resolve to 0.
- Integration: covered by the staging `messages_update` scenarios.
- End-to-end: authenticated `/chats` load followed by the peer seeing "Dostavljeno" needs two staging users.

## Handoff to testing

- Two staging users: A sends a message, B opens `/chats` (not the chat). A's message shows "Dostavljeno".
- With the network offline after the list loads, the list still renders.

## Test status

- Automated status: Partially covered
- Test files: `tests/delivery.test.ts`
- Scenarios covered: accepted-only updates, no-op without accepted matches, failure swallowing
- Remaining gaps: two-user staging run; component test of the panel (no React Testing Library yet)
- Manual testing: Not run unless explicitly requested
