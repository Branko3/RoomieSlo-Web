# Duplicate-request prevention

- Status: Implemented
- Date: 2026-10-11
- Web surfaces: "Pošlji zahtevo za ujemanje" on `/listings/[id]` (`components/match-request-button.tsx`), `lib/matching/send-request.ts`
- Android behavior preserved: `MatchRepository.sendRequest` inserts `matches (user_id_a = me, user_id_b = owner)`; the detail screen disables the button once a request is sent and shows "Zahteve ni bilo mogoče poslati." on failure. The database constraints from the migrations stay the boundary: the unique index `matches_user_pair_idx` on `(least, greatest)` and the check `matches_distinct_users`.

## Behavior

- With Supabase configured, the listing detail page asks the server whether a request already exists between the signed-in user and the owner, in either direction, before showing the button:
  - none → "Pošlji zahtevo za ujemanje";
  - existing → its state instead of a button: "Zahtevo si že poslal(a). Čaka na odgovor." / "Ta oseba ti je že poslala zahtevo. Odgovori nanjo med klepeti." / "Že sta povezana. Klepet najdeš med klepeti." / "Ta oseba je tvojo zahtevo zavrnila." / "To zahtevo si že zavrnil(a).", always with "Odpri klepete →";
  - own listing → "To je tvoj oglas."; signed out → "Prijavi se za pošiljanje zahteve".
- Sending re-checks for an existing request and only then inserts. If another tab inserted in between, the unique index rejects the insert (`23505`) and the existing request is shown instead of an error. Two simultaneous sends therefore produce exactly one row.
- Requests to oneself are refused before the request and by the database check (`23514`).
- While sending, the button is disabled ("Pošiljanje …"). On success: "Zahteva je poslana. Odpri klepete →", and the `/chats` request list is invalidated.
- Failures show Android's "Zahteve ni bilo mogoče poslati." or the offline message; a failed lookup offers "Poskusi znova".
- Without Supabase configuration the existing prototype form is kept unchanged. Its optional message is not part of the real flow: `matches` has no message column and Android sends none.

## Acceptance criteria

- [x] A user cannot create a second request to the same person, in either direction, from the UI.
- [x] A race between two sends results in one request and no error for the user (`23505` handled).
- [x] Self-requests are refused (client and `23514`).
- [x] An existing request's state is shown instead of the send button.
- [x] Sending uses Android's insert, and failures use Android's copy.
- [ ] Verified against the real unique index and RLS (`matches_insert`) with two sessions (blocked: staging credentials and installed browsers).
- [ ] Disabled for filled listings in the real flow (the filled state comes from PR #27; `MatchRequestButton` accepts `disabled` for that).

## Implementation

- `lib/matching/send-request.ts`:
  - `pairFilter` (both directions), `loadRequestState`, `sendMatchRequest` (lookup → insert → on `23505` re-lookup; `23514` → self),
  - `existingRequestMessage`, `SendRequestError`.
- `components/match-request-button.tsx` — TanStack Query state per owner, mutation, all states above.
- `app/listings/[id]/page.tsx` — uses the button when Supabase is configured (the file was reformatted by Prettier; other open PRs edit this page too, so expect small merge conflicts).
- `app/globals.css` — `.field-hint` and `.error-message` (also in other open PRs; keep one when merging).
- Relation to other PRs: #36/#37 handle the recipient's side of these requests; "Match-request creation" itself was skipped by the loop's rule (its status was "Yes (prototype feedback)"), and this PR replaces that prototype with the real insert.

## Testing contract

- Unit: the pair filter; create; no insert when a request exists in either direction; the race returns the winner; simultaneous sends create one row; self refused (client and `23514`); signed out; failure and offline copy; request state for none/existing/own/signed out; lookup errors; copy for every existing state. Implemented against an in-memory table that enforces the same unique-pair and distinct-users constraints.
- Integration: the real unique index and RLS with two sessions (staging).
- End-to-end: send a request, reload, see "Zahtevo si že poslal(a)…"; the owner sees no button; double-clicking or two tabs create one request.
- Manual: none beyond the above.

## Handoff to testing

All unit scenarios above; component checks for each button state and the success message.

## Test status

- Automated status: Partially covered
- Test files: `tests/send-request.test.ts`
- Scenarios covered: all unit scenarios (15 tests, passing with `npm run test`).
- Remaining gaps: the button is not component-tested (no React Testing Library/jsdom); no run against the real database or two browser sessions; the filled-listing guard depends on PR #27.
- Manual testing: Not run unless explicitly requested
