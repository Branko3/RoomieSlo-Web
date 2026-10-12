# Insufficient-answer empty state

- Status: Implemented
- Date: 2026-10-11
- Web surfaces: `/recommendations` (empty state and per-card badge), `lib/matching/answer-sufficiency.ts`
- Android behavior preserved: none to copy — Android shows every recommendation with 0 % when the user has not answered the questionnaire, which is indistinguishable from a real 0 % match. The web keeps Android's scores and ordering (PR #33) and adds the guidance the backlog asks for.

## Behavior

- Before showing recommendations, `/recommendations` checks how many statements the user actually answered (weight > 0; "Ne želim odgovoriti" does not count).
  - **No answers** (no profile row, nothing answered, or everything skipped): "Najprej izpolni vprašalnik — Priporočila razvrstimo po združljivosti tvojih odgovorov. Odgovori na vsaj 3 trditve o življenjskem slogu." with a button to `/profile/questionnaire`.
  - **Fewer than 3 expressed answers:** "Za priporočila potrebujemo več odgovorov — Odgovoril(a) si na N trditev. Odgovori še na M trditvi …" with the same button.
  - **3 or more:** the ranked list as in PR #33.
- The threshold exists because the score is normalized by answered weight: with one or two answers a single statement decides the whole ranking, so the percentages would look precise without being meaningful.
- On the list, a candidate who shares no answered statement with the user shows "—" (`aria-label` "Združljivosti ni mogoče izračunati: ni skupnih odgovorov") instead of a misleading 0 %. Ordering is unchanged (they rank with 0, as on Android).
- Slovenian count forms are correct (1 trditev, 2 trditvi, 3–4 trditve, 5+ trditev), and the copy avoids assuming the user's gender ("Odgovoril(a)").

## Acceptance criteria

- [x] Users without expressed answers see an explanation and a link to the questionnaire instead of a list of 0 % scores.
- [x] Users below the minimum see how many more answers are needed.
- [x] Skipped answers ("Ne želim odgovoriti") never count toward the minimum.
- [x] Candidates with no shared answered statements show "—" instead of 0 %.
- [x] Copy uses correct Slovenian plural forms.
- [ ] The questionnaire link resolves on `main` (the `/profile/questionnaire` route is added by PR #22).
- [ ] Verified in a browser (blocked: no installed browsers).

## Implementation

- `lib/matching/answer-sufficiency.ts`:
  - `MIN_EXPRESSED_ANSWERS` (3), `QUESTIONNAIRE_ROUTE`,
  - `expressedAnswerCount`, `sharedStatementCount`, `recommendationReadiness`, `readinessMessage`, `statementsLabel`.
- `app/recommendations/page.tsx` — readiness check before the list, the "—" badge; `app/globals.css` — `.compatibility-unknown`.
- **Stacked on PR #33** (Compatibility-ranked recommendations): this branch starts from `agent/compatibility-ranked-recommendations` because it changes the page that PR adds. Once #33 merges, this PR's diff reduces to the files above.

## Testing contract

- Unit: expressed count (weights, duplicates, null), readiness (no answers, all skipped, below, exactly at, custom threshold), shared statements (weights on both sides, null, no overlap), Slovenian plural forms, messages for each state, questionnaire route.
- Integration: none.
- End-to-end: a user with 0, 2, and 3+ answers sees the right state; a candidate without overlap shows "—".
- Manual: none beyond the above.

## Handoff to testing

All unit scenarios above; component checks for the empty state, button link, and "—" badge.

## Test status

- Automated status: Partially covered
- Test files: `tests/answer-sufficiency.test.ts`
- Scenarios covered: all unit scenarios (19 tests, passing with `npm run test`).
- Remaining gaps: the page states are not component-tested (no React Testing Library/jsdom in the repo); no browser run; the questionnaire route depends on PR #22.
- Manual testing: Not run unless explicitly requested
