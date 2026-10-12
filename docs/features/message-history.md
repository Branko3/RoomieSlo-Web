# Message history

- Status: Implemented
- Date: 2026-10-11
- Web surfaces: the conversation area of `/chats/[matchId]` (`components/message-history.tsx`), `lib/chat/messages.ts`
- Android behavior preserved: `ChatRepository.getMessages` loads all messages of a match ordered by `sent_at` ascending and shows "Napaka pri nalaganju sporočil." on failure; the conversation shows the newest message at the bottom. RLS `messages_select` limits rows to the match's participants.

## Behavior

- For an accepted match, the conversation area loads all messages of the match, oldest first, and keeps the newest in view.
- Messages are grouped by Ljubljana calendar day with "Danes", "Včeraj", or a Slovenian date ("ponedeljek, 5. oktober") as separators, and each shows its time (HH:MM, Europe/Ljubljana).
- Own messages are right-aligned (green); the other person's are left-aligned (grey). Line breaks are kept and long words wrap.
- Accessibility: the list is a `role="log"` region with `aria-live="polite"`, labelled "Sporočila z osebo …", with a visually hidden "Ti:" / "<name>:" prefix per message.
- States: loading ("Nalaganje sporočil …"), empty ("Še ni sporočil. Pozdravi osebo …"), error with retry (offline or Android's "Napaka pri nalaganju sporočil."), signed out.
- Malformed rows are skipped and duplicate ids dropped, so one bad row cannot break the conversation and later Realtime inserts cannot duplicate messages.

## Acceptance criteria

- [x] An accepted conversation shows its full message history in chronological order.
- [x] Messages show the sender side, the time, and day separators in Ljubljana time.
- [x] Loading, empty, error/retry, and signed-out states are handled.
- [x] The history is accessible as a live log with sender labels.
- [x] Malformed and duplicate rows do not break the list.
- [ ] Composer, local insertion, delivery/read states, and Realtime (separate Phase 5 features).
- [ ] Verified against real RLS with two users (blocked: staging credentials and installed browsers).

## Implementation

- `lib/chat/messages.ts`:
  - `MESSAGE_COLUMNS` (Android columns plus `sent_at`), `loadMessages(client, matchId)` (reuses the existing `mapMessage` validator),
  - `dayKey`, `dayLabel`, `messageTime`, `groupByDay`, `MessagesError`.
- `components/message-history.tsx` — TanStack Query (`["messages", matchId]`, exported as `messagesQueryKey` for the composer and Realtime features), the log rendering, and auto-scroll.
- `app/chats/[matchId]/page.tsx` renders it inside the conversation area; `app/globals.css` adds bubble, separator, and scroll styles.
- Like Android, all messages are loaded at once; paging older messages can be added if conversations grow long.
- **Stacked on PR #40** (Conversation route): this branch starts from `agent/conversation-route-chats-matchid` because it fills that PR's conversation area. Once #40 merges, this PR's diff reduces to the files above.

## Testing contract

- Unit: query shape and order; skipping malformed rows and duplicates; the empty result; signed-out guard; offline and failure copy; the Ljubljana day boundary and time; "Danes"/"Včeraj"/date labels; grouping order; an empty list.
- Integration: RLS — non-participants read no messages (staging).
- End-to-end: open an accepted conversation with messages across days; check order, sides, and separators; the empty state.
- Manual: none beyond the above.

## Handoff to testing

All unit scenarios above; component checks for bubble alignment, the live region, auto-scroll, and states.

## Test status

- Automated status: Partially covered
- Test files: `tests/messages.test.ts`
- Scenarios covered: all unit scenarios (9 tests, passing with `npm run test`).
- Remaining gaps: the component is not component-tested (no React Testing Library/jsdom); no two-user or RLS run; sending and Realtime come with later features.
- Manual testing: Not run unless explicitly requested
