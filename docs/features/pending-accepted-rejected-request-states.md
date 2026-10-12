# Pending/accepted/rejected request states

- Status: Implemented
- Date: 2026-10-11
- Web surfaces: "Zahteve za ujemanje" panel at the top of `/chats` (`components/match-requests-panel.tsx`), `lib/matching/match-requests.ts`
- Android behavior preserved:
  - `MatchRepository.getMyMatches`, `acceptMatch`, and `rejectMatch` (conditional update on `status = 'pending'`, an empty result means Conflict),
  - `ChatListViewModel` (`MatchRow` with peer name and `iAmRecipient = user_id_b == me && pending`),
  - the `ChatScreens` copy: "Sprejeto — odpri klepet", "Nova zahteva za ujemanje", "Čaka na odgovor", "Zavrnjeno", "Sprejmi", "Zavrni", "Ta zahteva je bila že obravnavana.", "Zahteve ni bilo mogoče sprejeti/zavrniti.".

## Behavior

- `/chats` shows the signed-in user's matches, newest first, each with the other person's display name and status.
  - **Incoming pending** (sent to me): "Nova zahteva za ujemanje" with "Sprejmi" and "Zavrni".
  - **Outgoing pending** (sent by me): "Čaka na odgovor", no actions.
  - **Accepted**: "Sprejeto — odpri klepet" with a link to `/chats/[matchId]`.
  - **Rejected**: "Zavrnjeno" (dimmed).
- Accept and reject update the row only while it is still `pending` and only when the current user is the recipient (`user_id_b`). If nothing changes (the other side or another tab already handled it), the user sees "Ta zahteva je bila že obravnavana.". After any response the list is refreshed from the server, so the real state is shown. Buttons are disabled while a response is in flight.
- States: loading, signed out (link to `/login`), error with retry (offline or generic copy), empty ("Še nimaš zahtev za ujemanje…"), not configured (the panel is hidden and the preview chat list is unchanged).

## Acceptance criteria

- [x] Users see their pending (incoming and outgoing), accepted, and rejected requests with the Android labels.
- [x] Only the recipient can accept or reject, and only while the request is pending.
- [x] A request already handled elsewhere is reported as a conflict, not a silent success, and the list refreshes.
- [x] Accepted requests link to the conversation.
- [x] Loading, signed-out, error, and empty states are handled with safe messages.
- [ ] Database-enforced recipient-only responses (see security note; needs an RLS/RPC change).
- [ ] The conversation route `/chats/[matchId]` exists (separate backlog feature).
- [ ] Verified against real RLS and data (blocked: staging credentials).

## Implementation

- `lib/matching/match-requests.ts`:
  - `MATCH_COLUMNS`, `loadMyMatches` (`or(user_id_a.eq.me,user_id_b.eq.me)`, `order created_at desc`, display names via `profiles.in("id", peerIds)`),
  - `toMatchRows`, `matchStatusLabel`,
  - `respondToMatch(client, id, decision)` (`update({status}).eq(id).eq(status,'pending').eq(user_id_b, me).select`),
  - `MatchRequestError` (signed-out / conflict / offline / failed).
- `components/match-requests-panel.tsx` — TanStack Query list and mutation with invalidation; `app/chats/page.tsx` renders it above the existing preview chat list (the static list is replaced by the "Chat list" feature).
- **Security note:** the `matches_update` policy and the `accept_match` RPC allow _either_ participant to change the status, so the requester can accept their own request through the API. The web client adds `user_id_b = me`, but the database should enforce it (recipient-only check in the policy or RPC). Recorded for the RLS review (PR #8).
- The atomic `accept_match` RPC already exists in the migrations; switching acceptance to it is the next backlog feature, "Match acceptance conflict handling".

## Testing contract

- Unit: labels for every state and role; row building (peer, recipient flag, fallback name); loader queries, ordering, name lookup, the empty case, signed-out guard, error mapping; respond guards (id, pending, recipient), the reject payload, conflict on an empty update, per-decision failure copy, network failure, session requirement.
- Integration: RLS — non-participants cannot read or update; recipient-only responses once enforced (staging).
- End-to-end: user A requests, user B sees "Nova zahteva" and accepts, A sees "Sprejeto"; a double accept from two tabs shows the conflict message.
- Manual: none beyond the above.

## Handoff to testing

All unit scenarios above; component checks for the panel states, the disabled buttons while in flight, and the refresh after a conflict.

## Test status

- Automated status: Partially covered
- Test files: `tests/match-requests.test.ts`
- Scenarios covered: all unit scenarios (15 tests, passing with `npm run test`).
- Remaining gaps: the panel is not component-tested (no React Testing Library/jsdom in the repo); no two-user browser run; the database does not yet restrict responses to the recipient; the conversation route is a separate feature.
- Manual testing: Not run unless explicitly requested
