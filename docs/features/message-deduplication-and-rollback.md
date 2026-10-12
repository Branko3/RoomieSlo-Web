# Message deduplication and rollback

- Status: Implemented
- Date: 2026-10-11
- Web surfaces: the conversation on `/chats/[matchId]` (`components/use-chat-sender.ts`, `components/use-message-realtime.ts`, `components/message-history.tsx`), `lib/chat/dedupe.ts`, `lib/chat/send-message.ts`
- Android behavior preserved: Android appends a message from the insert response or from Realtime only if no message with the same id is in the list (`messages.none { it.id == ... }`). The web keeps that rule and makes it hold for every path by giving each message its final id before it is sent.

## Behavior

- Each message gets its final UUID in the browser when "Pošlji" is pressed (`messages.id` is a UUID with a default, and the insert may supply it). The local "sending" copy, the insert response, the Realtime echo, and any refetched copy therefore share one id.
- **No duplicates, whatever arrives first:** the Realtime echo of my message and the insert response both replace the local copy by id; whichever comes second is ignored. The other person's messages are inserted in time order. Two identical texts sent in a row stay two messages, because their ids differ.
- **Reconnect reconciliation:** every history refetch (after a Realtime reconnect, or on returning to the tab) merges with the cache:
  - server messages are the source of truth;
  - messages missed during the outage appear in time order;
  - local messages still "sending" or "Ni poslano" are kept;
  - a local message whose id is already on the server is dropped, because it was stored.
- **Rollback when the outcome was unknown:** if a send failed on the client but was actually stored (the response was lost), "Poskusi znova" resends the same id. The database rejects it with `23505`, so the app removes the local copy and refetches, showing the server's version instead of sending a duplicate.
- Real failures still leave the message as "Ni poslano" with retry and discard (PR #43).

## Acceptance criteria

- [x] A message is never shown twice, regardless of the order of the insert response, the Realtime echo, and refetches.
- [x] Identical texts sent in a row remain separate messages.
- [x] Reconnect reconciliation adds missed messages and keeps unsent local messages.
- [x] Retrying a message that was already stored never creates a duplicate; the local copy is rolled back.
- [x] Automated tests cover reconnect and optimistic-failure cases.
- [ ] Verified with two browser sessions and real network interruptions (blocked: staging credentials and installed browsers).

## Implementation

- `lib/chat/dedupe.ts`:
  - `newMessageId` (`crypto.randomUUID` with an RFC 4122 v4 fallback),
  - `upsertStored` (replace the local copy by id, ignore an existing stored copy, otherwise insert in time order),
  - `mergeServerHistory` (refetch merge), `dropLocal` (rollback).
- `lib/chat/send-message.ts` — `sendMessage(client, matchId, draft, id?)` supplies the id and maps `23505` with an id to the `already-sent` error.
- `components/use-chat-sender.ts` — creates locals with the final id, confirms with `upsertStored`, and rolls back on `already-sent`.
- `components/use-message-realtime.ts` — Realtime inserts use `upsertStored`.
- `components/message-history.tsx` — the query function merges refetched history with the cache.
- RLS `messages_insert` does not restrict `id`; a client-chosen UUID only lets the sender name their own message, and the primary key prevents reuse.
- **Stacked on PR #46** (→ #45 → #44 → #43 → #42 → #41 → #40): this branch starts from `agent/reconnect-with-bounded-backoff`. Once those merge, this PR's diff reduces to the files above.

## Testing contract

- Unit:
  - UUID format, uniqueness, and the fallback;
  - echo-before-response and response-before-echo; identical texts in a row; the other person's messages in time order;
  - refetch merges that keep sending and failed locals, drop stored locals, add missed messages in order, and handle the first load;
  - rollback after a retry finds the message stored, with no-op cases;
  - never replacing a stored copy;
  - `sendMessage` sending the id, mapping a duplicate id to `already-sent`, and keeping the old behavior without an id.
- Integration: two sessions with a forced disconnect and a slow insert (staging).
- End-to-end: send while the network flaps; the message appears once on both sides.
- Manual: none beyond the above.

## Handoff to testing

All unit scenarios above; browser checks with throttled and interrupted networks.

## Test status

- Automated status: Partially covered
- Test files: `tests/dedupe.test.ts`
- Scenarios covered: all unit scenarios (16 tests, passing with `npm run test`).
- Remaining gaps: no two-session or real network-interruption run; the hooks are not component-tested (no React Testing Library/jsdom).
- Manual testing: Not run unless explicitly requested
