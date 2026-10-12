# Compatibility calculation parity with Android

- Status: Implemented
- Date: 2026-10-11
- Web surfaces: `lib/compatibility/compatibility.ts` (used by `/recommendations` in PR #33)
- Android behavior preserved: `domain/usecase/CalculateCompatibilityScoreUseCase.kt` and its unit tests `CalculateCompatibilityScoreUseCaseTest.kt`, plus the percentage and ordering used by `RecommendedProfilesViewModel`.

## Behavior

- `compatibilityScore(a, b) = Σ wᵢ·(1 − |aᵢ − bᵢ|) / Σ wᵢ` with `wᵢ = min(w_aᵢ, w_bᵢ)`:
  - only statements answered by both users with a positive weight are counted,
  - so "Ne želim odgovoriti" (weight 0) on either side removes the statement,
  - no shared statement gives 0,
  - the result is normalized to 0..1 regardless of how many statements were answered.
- When the other profile repeats a statement, the last answer wins (Kotlin `associateBy`).
- Every arithmetic step is rounded to 32-bit float (`Math.fround`), mirroring Kotlin `Float`, so results match Android bit for bit.
- `compatibilityPercent` = `round(score × 100)` (Kotlin `roundToInt`, half up). Without the user's own profile it is 0, like Android.
- `rankByCompatibility` sorts by descending percentage with a stable sort (Kotlin `sortedByDescending`), so ties keep the input order.

## Acceptance criteria

- [x] Equal answers produce the highest score (1).
- [x] Opposite answers produce the lowest score (0).
- [x] Statements answered by only one user are ignored.
- [x] Weight-zero ("prefer not to answer") answers are ignored on either side, and the score is symmetric.
- [x] Higher-weight statements affect the result more strongly.
- [x] Scores are normalized regardless of the number of answered statements.
- [x] Results match a Float32 reference of the Kotlin loop exactly, percentages round like `roundToInt`, and ranking is deterministic.
- [x] The calculation works on rows produced by the web questionnaire, including skipped questionnaires.

## Implementation

- `lib/compatibility/compatibility.ts` — framework-free `compatibilityScore`, `compatibilityPercent`, and `rankByCompatibility`. Byte-identical to the copy in PR #33.
- `lib/questionnaire/model.ts` — byte-identical copy from PRs #22/#23, used so the ported tests read statement weights from the questionnaire exactly as the Android tests read `Vprasalnik`. All of these PRs merge cleanly in any order.
- Where the calculation should run long-term (client vs. database function) is a privacy decision tracked in PR #33 and the RLS review; the formula stays the same either way.

## Testing contract

- Unit: the seven Android tests ported one-to-one; bit-exact comparison with an independent Float32 reference over 1,600 generated profile pairs including skipped answers; bounds and self-compatibility; integration with web questionnaire rows; a fully skipped questionnaire; deterministic ranking.
- Integration: none required (pure logic).
- End-to-end: none required for this logic-only feature.
- Manual: optional spot-check against the Android app for the same two accounts.

## Handoff to testing

Everything above is automated in `tests/compatibility-parity.test.ts`.

## Test status

- Automated status: Covered
- Test files: `tests/compatibility-parity.test.ts`
- Scenarios covered: all seven Android unit tests plus five additional parity checks (12 tests, passing with `npm run test`).
- Remaining gaps: None for the calculation; UI and data loading are covered by PR #33.
- Manual testing: Not run unless explicitly requested
