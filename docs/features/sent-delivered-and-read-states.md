# Sent, delivered, and read states

- Status: Implemented
- Date: 2026-10-11
- Web surfaces: own messages in `/chats/[matchId]` (`components/message-history.tsx`), `lib/chat/delivery.ts`
- Android behavior preserved:
  - `ChatRepository.markRead` runs when a conversation is open: the other person's messages that are not yet read become `read`.
  - `ChatRepository.markDelivered` runs when the chat list opens: only the other person's `sent` messages become `delivered`.
  - Only the recipient changes a message's state, and the state never moves backwards.
  - Marker failures are ignored so the chat keeps working.
  - Own messages show "Poslano" / "Dostavljeno" / "Prebrano" (`besediloStanja`), and other people's messages show no state.

## Behavior

- In an open conversation, as soon as the loaded history contains the other person's messages that are not read, they are marked `read` on the server (only theirs, only unread rows) and in the local history. A failure is ignored.
- Own confirmed messages show their time and state, for example "20:15 · Prebrano" ("Prebrano" in bold). Local messages keep their "Pošiljanje …" / "Ni poslano" states from PR #43.
- Returning to the tab refetches the history, so the state of own messages updates (Android also refreshes it on the next read; Realtime will make it live).
- `markDelivered` is implemented with Android's filters for the chat list; it is wired up with the "Chat list" feature, which replaces the static preview list on `/chats`.

## Acceptance criteria

- [x] The other person's messages become read when the conversation is open, without touching own messages or moving states backwards.
- [x] Own messages show "Poslano", "Dostavljeno", or "Prebrano".
- [x] Marker failures never break the conversation.
- [x] Delivered marking follows Android (`sent` → `delivered`, other person only).
- [ ] Delivered marking runs when the chat list opens (needs the "Chat list" feature).
- [ ] Live state changes without refocusing (needs the Realtime features).
- [ ] Database: delivery updates should be restricted to the recipient and to `delivery_status` only (see the PR #42 security note on `messages_update`).
- [ ] Verified with two users (blocked: staging credentials and installed browsers).

## Implementation

- `lib/chat/delivery.ts`:
  - `deliveryLabel`, `isAdvance`,
  - `markRead` / `markDelivered` (same filters as Android, errors swallowed, `false` on failure),
  - `applyReadLocally` and `needsReadMarker`.
- `components/message-history.tsx` — the read-marker effect (runs once per unread state; no retry loop on failure), `refetchOnWindowFocus`, and the labels; `app/globals.css` — meta and label styles.
- **Stacked on PR #43** (→ #42 → #41 → #40): this branch starts from `agent/immediate-local-message-insertion`. Once those merge, this PR's diff reduces to the files above.

## Testing contract

- Unit: labels; forward-only ordering; `markRead` and `markDelivered` exact filters; no session, RLS error, and network failure return `false` without throwing; unread detection; the local read update touches only the other person's messages and returns the same object when unchanged.
- Integration: RLS allows the recipient to update delivery state (staging).
- End-to-end: user B opens the chat and user A's message shows "Prebrano" after A refocuses the tab.
- Manual: none beyond the above.

## Handoff to testing

All unit scenarios above; component checks for the labels and the read-marker effect.

## Test status

- Automated status: Partially covered
- Test files: `tests/delivery.test.ts`
- Scenarios covered: all unit scenarios (11 tests, passing with `npm run test`).
- Remaining gaps: the effect and labels are not component-tested (no React Testing Library/jsdom); delivered marking is not wired until the chat list exists; no two-user run.
- Manual testing: Not run unless explicitly requested
