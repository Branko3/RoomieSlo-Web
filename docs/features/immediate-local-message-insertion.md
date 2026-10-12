# Immediate local message insertion

- Status: Implemented
- Date: 2026-10-11
- Web surfaces: the conversation on `/chats/[matchId]` (`components/use-chat-sender.ts`, `components/message-history.tsx`, `components/message-composer.tsx`), `lib/chat/local-messages.ts`
- Android behavior preserved: Android clears the draft and appends the message only after the server returns it, ignoring a message whose id is already in the list. The web keeps the server copy as the source of truth and the id-based dedupe, and adds the immediate local insertion the backlog asks for.

## Behavior

- Pressing "Pošlji" (or Enter) clears the draft and shows the message at once at the end of the conversation, marked "Pošiljanje …" and slightly dimmed.
- When the server confirms, the local copy is replaced in place by the stored message (with its server id and time). If the stored message is already in the list — for example delivered first by Realtime — the local copy is removed, so the message never appears twice.
- If sending fails, the message stays in the conversation, marked "Ni poslano", with "Poskusi znova" and "Zavrzi". The reason is shown above the composer: Android's "Sporočila ni bilo mogoče poslati.", offline, signed out, or "V ta pogovor ne moreš pisati.".
  - Retry sends the same text again and returns to "Pošiljanje …".
  - Discard removes it.
  - Nothing typed is ever lost silently.
- Several messages can be sent quickly one after another; each is tracked by its own client-only id (`local-<uuid>`), and confirmations or failures apply only to their own message, in order.
- Local messages are always shown as the user's own and have no timestamp until confirmed.

## Acceptance criteria

- [x] A sent message appears immediately, before the server responds.
- [x] The local copy is replaced by the stored message on success without a reload and without duplicates.
- [x] A failed message stays visible with retry and discard, and its reason is shown.
- [x] Multiple messages in flight are tracked independently.
- [ ] De-duplication against Realtime events and rollback on reconnect (separate feature "Message deduplication and rollback").
- [ ] Verified in a browser with slow and failing networks (blocked: no installed browsers).

## Implementation

- `lib/chat/local-messages.ts`:
  - `LocalMessage` / `ChatEntry` / `ChatHistory`, `createLocalMessage`, `newLocalId`, `isLocal`,
  - state transitions `addLocal`, `confirmLocal`, `failLocal`, `retryLocal`, `removeLocal`, `findLocal` (all pure, on the `["messages", matchId]` cache).
- `components/use-chat-sender.ts` — `send`, `retry`, `discard`, and the last error. It uses `sendMessage` from PR #42 and invalidates the history if a message is confirmed before the history was loaded.
- `components/message-composer.tsx` now only collects and validates the draft; `components/message-history.tsx` renders local states and actions; `app/chats/[matchId]/page.tsx` wires them together.
- Edge case: a message sent before the history has loaded is not shown locally; it appears when the history loads (success) or only the error is shown (failure).
- **Stacked on PR #42** (Message composer → #41 → #40): this branch starts from `agent/message-composer`. Once #40–#42 merge, this PR's diff reduces to the files above.

## Testing contract

- Unit: local message shape and unique ids; immediate insertion; replacement on success; removal when the stored copy is already present; fail → retry → confirm; discard; two messages in flight confirmed and failed independently and in order; unknown ids and unloaded histories; server messages never touched.
- Integration: none.
- End-to-end: send on a throttled network and see "Pošiljanje …" then the stored message; go offline, send, see "Ni poslano", reconnect, and retry.
- Manual: none beyond the above.

## Handoff to testing

All unit scenarios above; component checks for the local states, the retry and discard buttons, and the error line.

## Test status

- Automated status: Partially covered
- Test files: `tests/local-messages.test.ts`
- Scenarios covered: all unit scenarios (10 tests, passing with `npm run test`).
- Remaining gaps: the hook and components are not component-tested (no React Testing Library/jsdom); no browser run on a slow or failing network; Realtime de-duplication is the next feature.
- Manual testing: Not run unless explicitly requested
