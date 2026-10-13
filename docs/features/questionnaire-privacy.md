# Questionnaire answer privacy

- Status: Blocked
- Date: 2026-10-14
- Web surfaces: `/recommendations`, `supabase/functions/recommendations`, `supabase/functions/_shared/compatibility.ts`, RLS on `questionnaire_answers`
- Android behavior preserved: no longer a requirement (owner decision 2026-10-13: the web is the priority). Android's client-side ranking reads other users' answers and will see none after this migration; it can call the same `recommendations` function.

## Behavior

Until now `qa_select using (true)` let every signed-in user read everyone's lifestyle answers (noise, cleanliness, guests, …), because the browser calculated compatibility itself. Now:

- `questionnaire_answers` is readable only by its owner.
- `/recommendations` calls the `recommendations` Edge Function. It identifies the caller from the token, reads the answers with the service role, ranks available profiles with the same compatibility code the parity tests cover, and returns each profile with its **score and the number of shared statements only**, never the answers.
- The page is unchanged for users: the same ranking, the "—" badge when no statements are shared, and the "answer more" empty state (from the caller's own answers, which the function also returns).

## Acceptance criteria

- [x] Other users' answers can't be read through the API.
- [x] The ranking is identical to before: same function, same parity tests.
- [x] The browser receives no one else's answers.
- [ ] Verified on staging (blocked: no staging project; the function isn't deployed).

## Implementation

- Migration `20261015000000_questionnaire_answers_private.sql`: `qa_select using (auth.uid() = profile_id)`.
- `lib/compatibility/compatibility.ts` moved to `supabase/functions/_shared/compatibility.ts`, an import-free module loaded by both Deno and Node. `lib/` re-exports it, so the existing imports and parity tests are unchanged. New: `sharedStatementCount` (moved from `lib/matching/answer-sufficiency.ts`, still re-exported there) and `scoreCandidates`, which ranks and strips `answers`.
- `supabase/functions/recommendations/index.ts`: token → user; own answers plus available profiles with answers via the service role; `scoreCandidates`; JSON `{ myAnswers, recommendations }`.
- `lib/matching/recommendations.ts` calls `functions.invoke("recommendations")`, validates the response shape, and maps 401 → signed-out and fetch errors → offline.
- `supabase/functions` is excluded from `tsc` (Deno code); coverage now also measures `supabase/functions/_shared`.

## Testing contract

- Unit: `tests/recommendations.test.ts` (`scoreCandidates` strips answers and counts shared statements; loader calls only the function; error mapping; malformed response), the unchanged parity tests, and `tests/questionnaire-privacy.test.ts` (effective policy and static function checks).
- Integration (staging): `integration/rls.int.ts`: A can't read B's answers; the function works for A and returns no `answers`.

## Handoff to testing

- Deploy: `supabase functions deploy recommendations` (and set `ALLOWED_ORIGIN`), then apply the migration.
- Compare `/recommendations` for one user before and after on staging: same order and percentages.

## Blocker

No staging project: the migration hasn't been applied and the function hasn't been deployed or run (no Deno or Supabase CLI here).

## Test status

- Automated status: Partially covered
- Test files: `tests/recommendations.test.ts`, `tests/compatibility-parity.test.ts`, `tests/questionnaire-privacy.test.ts`, `integration/rls.int.ts`
- Scenarios covered: listed above
- Remaining gaps: staging run; running the Deno function
- Manual testing: Not run unless explicitly requested
