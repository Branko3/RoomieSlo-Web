# Compatibility-ranked recommendations

- Status: Implemented
- Date: 2026-10-11
- Web surfaces: `/recommendations`, the "Priporočeni sostanovalci" quick action on `/listings`, `lib/compatibility/compatibility.ts`, `lib/matching/recommendations.ts`
- Android behavior preserved:
  - `CalculateCompatibilityScoreUseCase` (weighted similarity, smaller weight per statement, weight-0 statements dropped, normalization),
  - `RecommendedProfilesViewModel` (score × 100 rounded, descending stable sort, 0 % without the user's own profile),
  - `ProfileRepository.getRecommendationCandidates` (available profiles other than the user, with nested answers),
  - `RecommendedProfileCard` (name and age, faculty, percentage badge, verified and "Išče sostanovalca" badges, two-line bio),
  - the empty copy "Ni razpoložljivih profilov za priporočilo." and the error copy "Napaka pri nalaganju priporočil.".

## Behavior

- `/recommendations` loads, in parallel, the current user's own profile with answers and all available profiles other than the user with answers. It scores each candidate and lists them by descending compatibility.
- Scores: `S = Σ min(w_a, w_b)·(1 − |a − b|) / Σ min(w_a, w_b)` over statements both users answered with a positive weight. Displayed as a whole percentage (half up). Computed in 32-bit floats like Kotlin so percentages match Android exactly.
- Equal scores keep the server order (stable sort), so the list is deterministic.
- If the user has no profile row yet, every candidate shows 0 %, as on Android. Guidance for users with too few answers is the separate "Insufficient-answer empty state" feature.
- States: loading; signed out (link to `/login`); error with retry (offline or generic copy); empty; Supabase not configured.
- Each card shows "Ime, starost", faculty, a `NN%` badge (`aria-label` "Združljivost NN %"), the verified badge, the "Išče sostanovalca" badge, and a two-line bio.

## Acceptance criteria

- [x] Compatibility is calculated exactly like Android, including weights, skipped answers, normalization, rounding, and float precision.
- [x] Recommendations include only available profiles other than the current user and are ordered by descending compatibility, deterministically.
- [x] Recommendation cards show the Android profile details and the percentage.
- [x] Loading, signed-out, error/retry, and empty states are handled with safe messages.
- [x] The page is reachable from the listings dashboard.
- [ ] Verified against real profiles and answers (blocked: staging credentials).
- [ ] "Prijavi" (report) on each card — the report flow is a separate backlog feature and the route does not exist yet.
- [ ] "Send match request" from a recommendation — covered by the matching features.

## Implementation

- `lib/compatibility/compatibility.ts` — `compatibilityScore`, `compatibilityPercent`, and `rankByCompatibility` (framework-free; `Math.fround` at each step). The same module is the subject of the backlog item "Compatibility calculation parity with Android".
- `lib/matching/recommendations.ts`:
  - `PROFILE_WITH_ANSWERS` (Android column list),
  - `loadRecommendations(client)` (`auth.getUser`, two filtered selects, ranking, safe errors),
  - `nameAndAge`.
- `app/recommendations/page.tsx` — TanStack Query page; `app/listings/page.tsx` gains a quick-action card (the file was reformatted by Prettier).
- `app/globals.css` — recommendation list, card, badge, and `.error-message` styles (the same `.error-message` rule appears in other open PRs; keep one when merging).
- Privacy note (from the implementation plan): calculating on the client requires every available profile's answers to be readable by authenticated users (current `qa_select using (true)` policy). Moving the calculation behind a database function would limit that exposure; recorded for the RLS review.

## Testing contract

- Unit: equal → 1, opposite → 0, one-sided statements ignored, weight-0 on either side ignored, min weight, heavier weights dominate, normalization across counts, no overlap → 0, duplicate answers, float precision, percent rounding (including .5), null profile → 0, ranking order and stability, `nameAndAge`, loader queries and filters, ranking from loaded data, a missing own profile, null-field defaults, signed-out guard, offline/unknown errors.
- Integration: real profiles and answers with RLS (staging); parity spot-check against Android for the same accounts.
- End-to-end: open `/recommendations`, see cards ordered by percentage; empty and error states.
- Manual: compare a few scores with the Android app for the same users.

## Handoff to testing

All unit scenarios above; component checks for the card content, badges, and page states.

## Test status

- Automated status: Partially covered
- Test files: `tests/recommendations.test.ts`
- Scenarios covered: all unit scenarios (22 tests, passing with `npm run test`).
- Remaining gaps: the page is not component-tested (no React Testing Library/jsdom in the repo); no browser or staging run; report and match-request actions are separate features.
- Manual testing: Not run unless explicitly requested
