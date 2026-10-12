# Conversation route `/chats/[matchId]`

- Status: Implemented
- Date: 2026-10-11
- Web surfaces: `/chats/[matchId]` (`app/chats/[matchId]/page.tsx`), `lib/chat/conversation.ts`
- Android behavior preserved: the chat screen is opened per match (`savedStateHandle["matchId"]`), shows "Neveljavno ujemanje." for an invalid id, and is reachable only for matches the user is part of (RLS `matches_select`). Messages, sending, and Realtime are separate backlog items and are not part of this route shell.

## Behavior

- `/chats/[matchId]` checks the session, validates the id (UUID), and loads the match. Matches the user is not part of are hidden by RLS and read as "not found", like missing ones.
- For a match the user is part of it shows:
  - a header with the other person's initials, display name, verified tick (with an accessible label), and faculty;
  - a **listing context card** with the other person's newest available listings (up to 2), linking to their detail pages. Matches do not reference a listing, so the other person's own listings give the conversation its context. If loading them fails, the chat still opens.
  - **Accepted:** the conversation area (filled by the "Message history" and "Message composer" features).
  - **Pending, I sent it:** "Zahteva še čaka na odgovor. Pogovor se odpre, ko jo druga oseba sprejme." + "Odpri zahteve →".
  - **Pending, sent to me:** "Ta oseba ti je poslala zahtevo za ujemanje. Sprejmi jo med klepeti, da odpreš pogovor." + "Odpri zahteve →".
  - **Rejected:** "Zahteva za ujemanje je bila zavrnjena, zato pogovor ni na voljo."
- Other states: loading ("Odpiranje klepeta …"), signed out (link to `/login`), not found ("Klepet ni na voljo — Ta pogovor ne obstaja ali vanj nisi vključen."), error with retry (offline or generic copy), Supabase not configured.
- Every state has "← Nazaj na klepete".
- Side effect: the static preview rows on `/chats` link to `/chats/iva`, which was a 404 and now shows the friendly "not found" state; the preview list is replaced by the "Chat list" feature.

## Acceptance criteria

- [x] `/chats/[matchId]` exists and resolves the match, the other person, and the user's role.
- [x] Only participants can open a conversation; invalid, missing, and foreign matches show "not found" without leaking whether they exist.
- [x] A listing context card shows the other person's available listings.
- [x] Pending and rejected matches explain why messaging is not available and link back to the requests.
- [x] Loading, signed-out, error/retry, and unconfigured states are handled.
- [ ] Messages, composer, delivery states, and Realtime (separate Phase 5 features).
- [ ] Verified against real RLS with two users (blocked: staging credentials and installed browsers).

## Implementation

- `lib/chat/conversation.ts`:
  - `isMatchId`, `loadConversation(client, matchId)` (session → match → profile and listings in parallel),
  - `conversationNotice`, `ConversationError`, `PEER_LISTING_LIMIT`.
- `app/chats/[matchId]/page.tsx` — TanStack Query page with every state above; the accepted conversation area is a labelled `section` carrying `data-match-id` for the message features.
- `app/globals.css` — header, context card, notice, and body styles plus `.error-message` (the same rule appears in other open PRs; keep one when merging).
- Links into this route already exist in open PRs: accepted rows on `/chats` (#36) and the listing request status (#39).

## Testing contract

- Unit: UUID validation; the accepted conversation with peer and listing context and the exact queries; peer resolution when I sent the request; not found for an invalid id (no query), a missing match, or a foreign match; signed out (no query); name and profile fallbacks; listing context failure or malformed rows not blocking; offline/generic/profile errors; notices for pending (both sides), rejected, accepted, and non-conversation states.
- Integration: RLS — a non-participant cannot read the match (staging).
- End-to-end: open an accepted, a pending, a rejected, and a foreign match; check the copy and links.
- Manual: none beyond the above.

## Handoff to testing

All unit scenarios above; component checks for each page state and the back link.

## Test status

- Automated status: Partially covered
- Test files: `tests/conversation.test.ts`
- Scenarios covered: all unit scenarios (10 tests, passing with `npm run test`).
- Remaining gaps: the page is not component-tested (no React Testing Library/jsdom); no two-user or RLS run; messaging is delivered by later features.
- Manual testing: Not run unless explicitly requested
