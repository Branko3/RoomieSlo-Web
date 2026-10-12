# Questionnaire conversion and skip semantics

- Status: Implemented
- Date: 2026-10-11
- Web surfaces: `lib/questionnaire/model.ts` (used by `/profile/questionnaire` in PR #22)
- Android behavior preserved: `domain/model/Vprasalnik.kt` (`Trditev`, `Vprasalnik.trditve`, `LikertOdgovor`, `izVrednosti`) and the save logic in `QuestionnaireViewModel.shrani` / `ProfileRepository.saveMyAnswers`.

## Behavior

- **Statements:** the 11 statement ids, texts, order, and survey weights are identical to Android. Ids are the `questionnaire_answers.question_id` keys and must not change. Weights sum to 1 and are ordered from highest to lowest, so early skippers have answered the most important statements.
- **Likert levels:** "Sploh se ne strinjam" 0, "Se ne strinjam" 0.25, "Niti da niti ne" 0.5, "Se strinjam" 0.75, "Popolnoma se strinjam" 1 (multiplier 1), and "Ne želim odgovoriti" 0.5 (multiplier 0).
- **Stored → level (`levelFromStored`):**
  - a weight of 0, a negative weight, or NaN gives "Ne želim odgovoriti",
  - otherwise the nearest expressed level, so legacy continuous slider values snap to the scale,
  - an exact midpoint resolves to the lower level, like Kotlin `minBy`.
- **Rows → answers (`answersFromStored`):** statements without a row stay unselected, unknown ids are ignored, and the last duplicate row wins (Kotlin `associateBy`).
- **Answers → rows (`rowsForSave`):**
  - exactly one row per statement, in statement order,
  - `value` is the level value and `weight` is the statement weight × the level multiplier,
  - unselected statements are written as "Ne želim odgovoriti" (value 0.5, weight 0), so every user has a row for every statement and unexpressed answers never affect compatibility,
  - ids that are not statements are never written.
- **Skip semantics:** skipping uses exactly the same save. Skipping immediately writes 11 zero-weight rows, and skipping part-way keeps the given answers and zero-weights the rest. A restored skipped questionnaire shows explicit "Ne želim odgovoriti" choices and counts as 0 completed (`expressedCount`).

## Acceptance criteria

- [x] Statement ids, texts, order, and weights match Android.
- [x] Likert values and multipliers match Android.
- [x] Stored rows convert back to levels with Android's weight-0 and nearest-level rules, including legacy values and tie-breaking.
- [x] Saving converts answers to one row per statement with `weight = statement weight × multiplier`.
- [x] Skipping (immediately or part-way) zero-weights unanswered statements without dropping given answers.
- [x] Completion counts only expressed answers.
- [x] Every level round-trips through storage unchanged.

## Implementation

- `lib/questionnaire/model.ts` is framework-independent and has no Supabase dependency. Persistence (`select`/`upsert` with `onConflict: "profile_id,question_id"`) and the UI live in PR #22, which contains a byte-identical copy of this file, so the two PRs merge cleanly in either order.
- Compatibility scoring that consumes these rows is the separate feature "Compatibility calculation parity with Android".

## Testing contract

- Unit: everything listed under Behavior.
- Integration: none required (pure logic); persistence and RLS are covered by the Lifestyle questionnaire feature.
- End-to-end: none required for this logic-only feature.
- Manual: none.

## Handoff to testing

Statement and Likert parity tables; weight 0/negative/NaN; exact levels; legacy values 0.1, 0.3, 0.62, 0.9, 1.4, −0.2; midpoints 0.125 and 0.625; weighted rows are never "no answer"; unknown ids; duplicate rows; save rows and order; unknown answer ids; immediate and part-way skip; expressed count; restore of a skipped questionnaire; round trip of every level.

## Test status

- Automated status: Covered
- Test files: `tests/questionnaire-conversion.test.ts`
- Scenarios covered: every scenario in "Handoff to testing" (29 tests, passing with `npm run test`).
- Remaining gaps: None for this logic; persistence and UI gaps are tracked in PR #22.
- Manual testing: Not run unless explicitly requested
