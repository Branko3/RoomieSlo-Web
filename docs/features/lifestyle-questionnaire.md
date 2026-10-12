# Lifestyle questionnaire

- Status: Implemented
- Date: 2026-10-11
- Web surfaces: `/profile/questionnaire`, `components/lifestyle-questionnaire.tsx`, the "Nadaljuj →" link on `/profile`
- Android behavior preserved: `Vprasalnik.kt`, `LikertOdgovor`, `QuestionnaireViewModel`, and `ProfileRepository.saveMyAnswers`. The web version keeps the same 11 statement ids, order, and survey weights; the same six Likert levels with normalized values and multipliers; the same restore rules (weight 0 → "Ne želim odgovoriti", otherwise the nearest level); the same save (one row per statement, unselected rows saved as "prefer not to answer" with weight 0, upsert on `profile_id,question_id`); and the same skip behavior (skip is the same save).

## Behavior

- `/profile/questionnaire` loads the signed-in user's `questionnaire_answers` and pre-selects saved levels. Statements without a stored row stay unselected so a default never looks like the user's own choice.
- The header shows "Izpolnjenih N od 11 trditev" (only expressed answers count) and a "Preskoči" button at the top; "Shrani in nadaljuj" is at the bottom. Both save the same way.
- Each statement is a native radio group (`fieldset`/`legend`), which gives keyboard and screen-reader support; "Ne želim odgovoriti" is styled as a secondary option.
- While saving, inputs and buttons are disabled and the button reads "Shranjujem …". On success the user goes back to `/profile`, or to `/listings` when opened with `?from=onboarding` (Android: back to the profile, or listings at the end of onboarding). On failure a safe alert appears and the answers stay selected.
- Load states: loading, signed out (link to `/login`), error with "Poskusi znova", and unavailable when Supabase is not configured.

## Acceptance criteria

- [x] The statement ids, text, order, and weights match Android exactly.
- [x] Likert values and multipliers match Android; "prefer not to answer" is stored with weight 0.
- [x] Saved answers are restored, including legacy continuous slider values snapped to the nearest level.
- [x] Saving writes one row per statement through a single upsert on `profile_id,question_id`.
- [x] Skipping saves unanswered statements as "prefer not to answer" and leaves the questionnaire.
- [x] Loading, signed-out, error/retry, saving, and save-failure states are handled with safe messages.
- [x] The profile page links to the questionnaire.
- [ ] Verified against real RLS in a browser (blocked: staging credentials and Playwright browsers).

## Implementation

- `lib/questionnaire/model.ts`:
  - `STATEMENTS` and `LIKERT`,
  - `levelFromStored` (Kotlin `minBy` tie-breaking: the first closest level wins), `answersFromStored` (ignores unknown ids), `rowsForSave`, and `expressedCount`.
- `lib/questionnaire/persistence.ts`:
  - `loadMyAnswers` (`select("question_id,value,weight").eq("profile_id", uid)`) and `saveMyAnswers` (upsert with `onConflict`),
  - error mapping (signed-out, permission, offline, unknown) and `destinationAfterSave`.
- `components/lifestyle-questionnaire.tsx`, `app/profile/questionnaire/page.tsx` (Suspense for `useSearchParams`), and the link in `app/profile/page.tsx`.
- `app/globals.css` — questionnaire styles and `.error-message` (the same rule appears in PRs #18–#21; keep one when merging).
- The static "68 % / 17 od 25" profile card is left unchanged; showing real progress belongs with profile loading (PR #20).
- This feature includes the conversion and skip logic that the separate backlog item "Questionnaire conversion and skip semantics" describes. The tests below cover that parity.

## Testing contract

- Unit: statement and Likert parity, weight sum and order, restore for weight 0/negative/NaN, exact levels, legacy values and tie-breaking, unknown ids, save rows, skip rows, round trip, expressed count, query shapes, upsert payload and conflict key, error mapping, destination.
- Integration: RLS — a user can upsert only their own answers (staging).
- End-to-end: answer some statements, save, reopen and see them restored; skip from the top; save failure shows an alert.
- Manual: none beyond the above.

## Handoff to testing

All scenarios listed under Testing contract → Unit, plus a component check of the radio groups, counter, disabled state while saving, the save error alert, and redirect targets.

## Test status

- Automated status: Partially covered
- Test files: `tests/lifestyle-questionnaire.test.ts`
- Scenarios covered: all unit scenarios (32 tests, passing with `npm run test`).
- Remaining gaps: component rendering and interaction are not component-tested (no React Testing Library/jsdom in the repo); no Playwright run (no installed browsers); RLS needs a staging project.
- Manual testing: Not run unless explicitly requested
