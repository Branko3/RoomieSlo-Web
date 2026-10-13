# Profile availability and questionnaire progress

- Status: Implemented
- Date: 2026-10-13
- Web surfaces: `/profile`, `components/profile-status-cards.tsx`, `lib/profile/own-profile.ts`, `lib/questionnaire/model.ts`
- Android behavior preserved: `ProfileViewModel.setAvailability` updates the toggle optimistically and saves `profiles.is_available`. The questionnaire card shows "Izpolnjenih X od N trditev", where X counts expressed answers (`steviloIzrecenih`). Recommendations only show available profiles.

## Behavior

- "Iščem sostanovalca / sobo" now reflects and saves `profiles.is_available`. Before this change it was local React state that reset on every visit and was never saved. The toggle switches at once; if the save fails, it switches back and shows the Slovenian error. Clicks are ignored while a save is pending (`aria-busy`), and the button is not disabled, so keyboard focus is kept.
- The questionnaire card shows real progress from the saved answers: a percentage, "Izpolnjenih X od N trditev", a `progressbar`, and the link "Začni →", "Nadaljuj →" or "Uredi →". Before, it was hard-coded at 68% and "17 od 25".
- The inert ⚙ "Nastavitve profila" button was removed; there is no settings page.
- Both cards render only for a loaded profile. Loading, error and signed-out states stay in the profile header.

## Acceptance criteria

- [x] Availability is loaded from and saved to the user's own profile row.
- [x] A failed save rolls the toggle back and shows a message.
- [x] Questionnaire progress counts expressed answers out of all statements.
- [x] No hard-coded profile values remain on `/profile` when Supabase is configured.

## Implementation

- `updateAvailability(client, userId, isAvailable)`: an update on the user's own row that sends only `is_available`. An RLS-hidden row is a permission error, as in `updateOwnProfile`.
- `questionnaireProgress(answers)`: `{ answered, total, percent }`, using `expressedCount` and `STATEMENTS`.
- `AvailabilityCard` shares the `["profile", "own"]` query with the header and updates it optimistically. `QuestionnaireProgressCard` loads answers with `loadMyAnswers`.
- Authorization: the existing `profiles_update` policy (owner only); `academic_status_verified` stays protected by the #51 trigger.

## Testing contract

- Unit: `tests/own-profile.test.ts` (payload, permission, offline) and `tests/lifestyle-questionnaire.test.ts` (progress 0, 1 and all).
- End-to-end: `e2e/keyboard.spec.ts` toggles relative to the saved state and restores it (authenticated staging project).

## Handoff to testing

- Staging: toggle off, reload, still off; the profile disappears from another user's `/recommendations`.
- Answer some statements, return to `/profile`, and check the counts.

## Test status

- Automated status: Partially covered
- Test files: `tests/own-profile.test.ts`, `tests/lifestyle-questionnaire.test.ts`, `e2e/keyboard.spec.ts`
- Scenarios covered: save payload and error mapping, progress calculation, keyboard toggle (needs staging)
- Remaining gaps: staging run; component tests (no React Testing Library)
- Manual testing: Not run unless explicitly requested
