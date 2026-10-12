# Message composer

- Status: Implemented
- Date: 2026-10-11
- Web surfaces: the composer under the history on `/chats/[matchId]` (`components/message-composer.tsx`), `lib/chat/send-message.ts`
- Android behavior preserved: `ChatViewModel.send` trims the draft, ignores an empty message, clears the draft, inserts through `ChatRepository.sendMessage` (with `select`, so the stored row comes back), appends the returned message unless its id is already in the list, and shows "Sporočila ni bilo mogoče poslati." on failure.

## Behavior

- An accepted conversation shows a text box ("Napiši sporočilo …") and a "Pošlji" button below the message history.
- Enter sends; Shift+Enter inserts a line break; Enter during IME composition does nothing.
- The draft is trimmed; empty or whitespace-only drafts cannot be sent (the button is disabled). Messages are limited to 2000 characters; near the limit a counter appears, and over it the box is marked invalid and sending is disabled.
- On send the draft is cleared at once (Android) and the button shows "Pošiljanje …". The stored message returned by the server is appended to the history (no reload), skipping it if the same id is already shown.
- On failure the draft is restored (unless the user already typed something new), so the text is never lost — an improvement over Android, which drops it. Errors: "Sporočila ni bilo mogoče poslati.", offline, signed out, and "V ta pogovor ne moreš pisati." when RLS refuses the insert.
- Focus stays in the text box after sending.

## Acceptance criteria

- [x] Users can write and send a message in an accepted conversation; the stored message appears in the history without a reload.
- [x] Empty and over-long drafts are not sent.
- [x] Keyboard: Enter sends, Shift+Enter makes a new line, IME composition is respected.
- [x] Failures show Android's copy (or a specific reason) and keep the draft.
- [x] A message already shown is never appended twice.
- [ ] Showing the message before the server confirms it, and rolling back on failure (separate features "Immediate local message insertion" and "Message deduplication and rollback").
- [ ] Database checks: `messages_insert` should require an **accepted** match, and `messages_update` should not allow editing the other person's message body (see security notes).
- [ ] Verified with two users against real RLS (blocked: staging credentials and installed browsers).

## Implementation

- `lib/chat/send-message.ts`:
  - `validateDraft`, `MAX_MESSAGE_LENGTH`,
  - `sendMessage(client, matchId, draft)` (`insert({match_id, sender_id, body}).select(MESSAGE_COLUMNS).single()`, validated with `mapMessage`),
  - `appendMessage`, `SendMessageError`, `sendMessageCopy`.
- `components/message-composer.tsx` — form, keyboard handling, TanStack mutation updating the `["messages", matchId]` cache from PR #41.
- `app/chats/[matchId]/page.tsx` renders the composer under the history; `app/globals.css` adds composer styles.
- **Security notes** (existing policies, recorded for the RLS review, PR #8):
  - `messages_insert` checks only that the sender participates in the match, not that it is `accepted`, so participants of pending or rejected matches can still write through the API. The UI only shows the composer for accepted matches.
  - `messages_update` lets any participant update any message of the match, including its `body`, so a user can rewrite the other person's messages. It should be limited to the recipient changing `delivery_status`.
- **Stacked on PR #41** (Message history, itself stacked on #40): this branch starts from `agent/message-history`. Once #40 and #41 merge, this PR's diff reduces to the files above.

## Testing contract

- Unit: trimming, empty, line breaks, the length limit; the insert payload as the current user and returned row; no request for empty or too-long drafts; signed-out guard; RLS refusal; failure, offline, and missing-row copy; malformed stored rows; append, dedupe, and unloaded history.
- Integration: RLS — insert allowed only for participants (and, once enforced, only for accepted matches) (staging).
- End-to-end: type and send with Enter; Shift+Enter keeps writing; an offline send restores the draft.
- Manual: none beyond the above.

## Handoff to testing

All unit scenarios above; component checks for keyboard handling, the disabled state, the counter, and draft restoration.

## Test status

- Automated status: Partially covered
- Test files: `tests/send-message.test.ts`
- Scenarios covered: all unit scenarios (12 tests, passing with `npm run test`).
- Remaining gaps: the component is not component-tested (no React Testing Library/jsdom); no two-user or RLS run; the policy fixes need a database change.
- Manual testing: Not run unless explicitly requested
