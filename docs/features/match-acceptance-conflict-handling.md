# Match acceptance conflict handling

- Status: Implemented
- Date: 2026-10-11
- Web surfaces: "Sprejmi"/"Zavrni" in the `/chats` match-request panel, `lib/matching/match-acceptance.ts`
- Android behavior preserved: `MatchRepository.acceptMatch` treats an update that changes no row as `AcceptMatchResult.Conflict` and shows "Ta zahteva je bila že obravnavana.". The web keeps that outcome and makes acceptance atomic through the existing `accept_match` database function, as the implementation plan requires ("Make match acceptance atomic through an RPC or constrained update").

## Behavior

- "Sprejmi" calls `rpc("accept_match", { p_match_id })`. The function updates the row only while it is `pending` and bumps `version` in the same statement, so of two concurrent accepts (two tabs), or an accept racing a reject, exactly one succeeds.
- "Zavrni" keeps the constrained update (pending and recipient only).
- When either action loses a race, the row is re-read and the user sees what actually happened instead of a generic error:
  - already accepted → "Zahteva je že sprejeta."
  - rejected meanwhile → "Zahteva je bila medtem zavrnjena."
  - deleted or no longer visible → "Zahteva ne obstaja več."
  - still pending but the call was refused (not allowed) → "Te zahteve ne moreš sprejeti."
  - the follow-up read failed → Android's "Ta zahteva je bila že obravnavana."
- On success the list shows the confirmed state immediately (status and version from the server) and then refetches. After a conflict the list refetches so it shows the real state.
- Network and other failures keep the existing safe messages (offline / "Zahteve ni bilo mogoče sprejeti.").

## Acceptance criteria

- [x] Acceptance is atomic through the `accept_match` RPC; concurrent accepts or an accept/reject race produce exactly one winner.
- [x] The RPC's "unavailable" exception is treated as a conflict, not a technical error.
- [x] Conflicts tell the user the actual outcome (accepted, rejected, gone, not allowed), with the Android message as fallback.
- [x] The list reflects the confirmed state immediately and reconciles with the server afterwards.
- [ ] Recipient-only acceptance enforced by the database (the RPC accepts either participant; see the PR #36 security note).
- [ ] Verified against the real RPC with two browser sessions (blocked: staging credentials and installed browsers).

## Implementation

- `lib/matching/match-acceptance.ts`:
  - `acceptMatchAtomically`, `rejectMatchWithConflictCheck`, `readMatchStatus`,
  - `isAcceptConflict` (SQLSTATE P0001 or the function's message), `conflictMessage`,
  - `applyDecision` (cache update).
- `components/match-requests-panel.tsx` — the mutation now uses the functions above and updates the TanStack Query cache on success.
- **Stacked on PR #36** (Pending/accepted/rejected request states): this branch starts from `agent/pending-accepted-rejected-request-states` because it builds on that PR's module and panel. Once #36 merges, this PR's diff reduces to the files above.
- Database follow-up (RLS review, PR #8): restrict `accept_match` to `auth.uid() = user_id_b`, and consider an equivalent `reject_match` function so both actions share one server-side rule.

## Testing contract

- Unit: conflict copy per state, RPC exception detection, RPC accept with the returned version, two concurrent accepts (one winner, version 2), accept after reject, reject after accept, an accept/reject race (one winner), a missing row, a failed follow-up read, offline and generic failures, status read, cache update. Implemented against an in-memory database that applies the same pending-only rules as the SQL.
- Integration: two real sessions accepting the same request; a recipient-only check once enforced (staging).
- End-to-end: open the same request in two tabs, accept in both, and see one success and one "Zahteva je že sprejeta.".
- Manual: none beyond the above.

## Handoff to testing

All unit scenarios above; component checks for the immediate state change and the conflict alert.

## Test status

- Automated status: Partially covered
- Test files: `tests/match-acceptance.test.ts`
- Scenarios covered: all unit scenarios (16 tests, passing with `npm run test`).
- Remaining gaps: no run against the real `accept_match` function or two browser sessions; the panel is not component-tested (no React Testing Library/jsdom); recipient-only enforcement needs a database change.
- Manual testing: Not run unless explicitly requested
