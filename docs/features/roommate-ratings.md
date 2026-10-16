# Roommate ratings

- Status: Blocked
- Date: 2026-10-16 (thresholds approved by Branko, the data controller, 2026-10-16)
- Web surfaces:
  - `/chats/[matchId]`: the reminder and the rating form;
  - `/recommendations`: the summary on each card;
  - `/profile`: "Ocene sostanovalcev" and the toggle;
  - `/privacy`;
  - `/profile/delete-account`;
  - the data export;
  - the `recommendations` Edge Function;
  - Postgres: `roommate_ratings` and `profiles.show_roommate_ratings`, plus the RPCs.
- Android behavior preserved: no longer a requirement (owner decision 2026-10-13: the web is the priority). Android has no rating screens. The new profile column has a default, so Android's profile saves keep working.
- Plan: [`docs/nontechnical/cohabitation-and-ratings.md`](../nontechnical/cohabitation-and-ratings.md), Part B (§2, §4, §5, §6, §7 steps 3–5). Builds on [cohabitation declarations](cohabitation-declarations.md). Legitimate-interest assessment: [`roommate-ratings-lia.md`](../nontechnical/roommate-ratings-lia.md).

## Behavior

1. **Who can rate.** Only the participants of a cohabitation that both confirmed can rate, each person once per cohabitation. A block doesn't stop rating (plan §4.6).
2. **Window.**
   - It opens two months after the move-in month (at midnight, Slovenian time), or when the cohabitation is ended, if that's sooner.
   - It closes 60 days after the end. While the two still live together, it stays open.
   - The end is the time the cohabitation was ended in the app (`ended_at`), so a retroactive end month doesn't close the window at once.
3. **Answers.**
   - "Bi spet živel(a) s to osebo?" with **Da / Ne** (required).
   - Up to 3 strengths, shown publicly in aggregate:
     - `reliable_costs` "Zanesljiv(a) pri stroških";
     - `clean_tidy` "Čist(a) in urejen(a)";
     - `respects_quiet` "Spoštuje mir in počitek";
     - `good_communication` "Dobra komunikacija";
     - `keeps_agreements` "Upošteva dogovore";
     - `pleasant` "Prijeten/-tna sostanovalec/-ka".
   - Up to 3 improvements, which only the rated person sees, in aggregate:
     - `costs` "Stroški";
     - `cleanliness` "Čistoča";
     - `noise` "Hrup";
     - `communication` "Komunikacija";
     - `agreements` "Dogovori";
     - `visitors` "Obiski".

   The keys are stored in the database. The labels live in `lib/ratings/tags.ts`. The form says: "Ocena je anonimna in vidna šele, ko oceni tudi druga oseba ali po 14 dneh."

4. **Double-blind.** A rating is `hidden` until one of these happens:
   - the other person also rates (both ratings are revealed in the same transaction);
   - 14 days pass since the first submission;
   - the window closes.

   The daily job reveals ratings for the last two cases. Only revealed ratings count.

5. **Editing.**
   - The rater sees their own rating in the chat ("Tvoja ocena: …"), with the private tags marked "(zasebno)".
   - While the rating is hidden, the rater can edit it. The 14-day reveal still counts from the first submission.
   - After it is revealed, the rating can be updated once every 6 months, but only while the two still live together. Only the latest version counts.
6. **Reminders in the chat.**
   - When the window is open and I haven't rated: "Lahko oceniš sobivanje z osebo <Ime>."
   - In the last 7 days before it closes, the reminder adds "Ocenjevanje se zapre <datum>."
   - There are no push notifications.
7. **Summary for others.** On recommendation cards, not on listings:
   - With at least 3 revealed ratings from the last 36 months, the profile not deleted and `show_roommate_ratings` on: "**3 od 4** sostanovalcev bi spet živeli s to osebo", plus up to 3 of the most common strengths with counts ("Čist(a) in urejen(a) · 3"), ordered by frequency, ties in tag order.
   - Below 3 ratings: "Še ni dovolj ocen", with no count.
   - Turned off: "Ocene so skrite".
8. **My summary (`/profile`, "Ocene sostanovalcev").**
   - From 3 ratings: the same line and strengths, plus "Področja za izboljšanje" with counts.
   - Below 3: only the count ("2 oceni, prikazane bodo od 3 dalje"), or "Še nimaš ocen.".
   - The toggle "Prikaži ocene sostanovalcev" (on by default). It is an `aria-pressed` button that keeps focus while saving.
   - Nobody ever sees who gave which rating.
9. **Plurals.** Slovenian forms follow the last two digits, like `listingCountLabel`: "1 ocena", "2 oceni", "3–4 ocene", "5+ ocen" (101 is "ocena").
10. **Deletion.**
    - The ratings a user received are deleted with their account.
    - The ratings they gave stay in the other person's aggregate, linked only to the tombstone.
    - A deleted profile's summary is "insufficient", and nobody can rate it.
11. **Retention.**
    - Ratings are deleted 36 months after the cohabitation ended, or 36 months after the latest submission while it is still active.
    - They are also deleted with their cohabitation once both participants are tombstones.
    - A tombstone is kept while a rating refers to it.
12. **Privacy.**
    - `/privacy` names the data controller, Branko, with the contact e-mail from `NEXT_PUBLIC_PRIVACY_CONTACT`. While it is unset, the page says the contact is not set yet.
    - It has the section "Ocene sostanovalcev": the legal basis, what is shown, the threshold, the 36 months, hiding, and reporting unfair ratings to that e-mail.
    - The "Živiva skupaj" dialog adds "Ko živita skupaj, se lahko po dveh mesecih anonimno ocenita."
    - The data export (version 2) includes the ratings I gave, my cohabitations and my received aggregate (`my_rating_summary`), never rater identities.
    - The delete-account page lists the new rows.
13. **No in-app dispute process** (plan §4.6). Unfair ratings are handled manually by the owner (`docs/operations/privacy-procedures.md`). No report kinds or admin screens were added.

## Acceptance criteria

- [x] Only confirmed cohabitants rate, once per cohabitation; the window and the 6-month update rule are enforced on the server and mirrored in `lib/ratings/rules.ts`.
- [x] Fixed tag sets, at most 3 each, stored as stable keys; Slovenian labels in lib.
- [x] Double-blind reveal: on the second rating, after 14 days, or at window close.
- [x] Summaries only from 3 revealed ratings in the last 36 months, with opt-out and deleted profiles handled; never who rated.
- [x] The summary on recommendation cards (Edge Function plus validation), not on listings.
- [x] `/profile` summary, improvements, the count below the threshold, and the toggle.
- [x] `/privacy` controller and ratings section; the dialog sentence; the export; the delete-account copy.
- [x] `handle_deleted_user` and `purge_expired_data` keep every previous step.
- [ ] Verified on staging (blocked: no staging project); the Edge Function redeployed.
- [ ] `NEXT_PUBLIC_PRIVACY_CONTACT` set, and the LIA signed off by the owner.
- [ ] Checked by hand in a browser.

## Implementation

- `supabase/migrations/20261016000100_roommate_ratings.sql` (forward-only):
  - `public.roommate_ratings`:
    - `unique (cohabitation_id, rater_id)`;
    - check constraints on the tag sets (at most 3, from `rating_strength_tags()` and `rating_improvement_tags()`) and on `status`/`revealed_at`.
  - RLS: only `roommate_ratings_select_own` (`auth.uid() = rater_id`). There are no write policies. `revoke all` from `anon` and `authenticated`, then `grant select`.
  - `profiles.show_roommate_ratings boolean not null default true`. Users change it through the existing `profiles_update` policy. The profile guards from `20261011000100` and `20261014000000` pin only their own columns, which a test checks.
  - `rating_window_opens_at` and `rating_window_closes_at`: internal helpers.
  - `submit_roommate_rating(p_cohabitation_id, p_would_live_again, p_strengths, p_improvements)`:
    - a security-definer function that locks the cohabitation;
    - it checks the participant, a confirmed cohabitation, that no profile is deleted, the answer, the tags (at most 3, distinct, from the set), the window, and the edit or 6-month rule;
    - it reveals both ratings when the second one arrives;
    - error codes: `42501` authorization, `22023` invalid answers, `P0001` window or update rule.
  - `rating_summary(p_profile_id)`:
    - a security-definer function that never uses `auth.uid()`, so the service role can call it;
    - it returns aggregates only: `{state: 'hidden' | 'insufficient'}` or `{state: 'shown', total, would_live_again, strengths}`;
    - callable by `authenticated` and `service_role`.
  - `rating_summaries(uuid[])`: the batch used by the Edge Function, callable by the service role only.
  - `my_rating_summary()`: my aggregate, including improvements; below the threshold, only `count`; plus `visible`.
  - `handle_deleted_user` and `purge_expired_data`: the full bodies from `20261016000000`, plus the rating steps and the new `ratings_revealed` and `ratings` counters.
- `lib/ratings/`:
  - `tags.ts`: keys, labels, validation.
  - `rules.ts`: the window, edit/update/lock, reminders.
  - `summary.ts`: summary validation, wording, plurals.
  - `ratings.ts`: client calls, row validation, error mapping (signed-out, permission, offline, invalid, window, locked, unknown).
- `lib/cohabitation/months.ts`: `monthStart` (midnight on the first day, Slovenian time).
- `supabase/functions/recommendations/index.ts`: adds `ratings` per recommendation from `rating_summaries`. If that call fails, `ratings` is `null` and the list still loads.
- `lib/matching/recommendations.ts`: validates the new shape. A malformed summary invalidates the response.
- Components:
  - `components/chat-rating.tsx`: the reminder, the form and my rating. It sits under the cohabitation controls in accepted chats.
  - `components/rating-summary.tsx`: the cards.
  - `components/my-ratings-section.tsx`: `/profile`.
  - Query keys are in `components/cohabitation-queries.ts`.
- `lib/privacy/controller.ts`: the controller name and contact. `lib/privacy/export.ts` is now version 2.
- `app/privacy/page.tsx` and `app/profile/delete-account/page.tsx`: the copy changes above.

## Testing contract

- Static migration test (`tests/roommate-ratings-migration.test.ts`):
  - RLS, and that no write policies or grants exist;
  - every check in `submit_roommate_rating`;
  - the reveal rules;
  - the threshold of 3, the 36-month window, opt-out and deleted profiles;
  - that `rating_summary` doesn't use `auth.uid()` and returns no rater or improvement data;
  - the grants;
  - that `handle_deleted_user` and `purge_expired_data` keep every statement and counter of their previous definitions.
- Unit tests:
  - `tests/ratings.test.ts`: tag validation, window/edit/update rules, reminders, summary validation and wording, plurals, the client calls and error mapping.
  - `tests/recommendations.test.ts`: the new response shape and its rejection cases.
  - `tests/privacy.test.ts`: export contents (ratings given, cohabitations, the received aggregate without rater ids), the controller module, and the `/privacy` copy.
- Component tests:
  - `tests/components/chat-rating.test.tsx`: the form (required Da/Ne, the 3-tag limit, the anonymity note), edit while hidden with focus return, lock after reveal, the closing reminder, and a server refusal.
  - `tests/components/my-ratings-section.test.tsx`: the summary and improvements, the count below the threshold, the toggle (keyboard, focus, failed save), and load errors.
- Integration (staging, `integration/ratings.int.ts`):
  - the rater reads their own hidden rating;
  - the rated person reads no rows;
  - direct writes and the batch summary are refused;
  - a summary below 3 is `insufficient`;
  - a third party (the admin test account) sees nothing and can't rate.
- Executed SQL (not in CI): both new migrations and the whole migration chain were applied to PGlite (Postgres in WASM) with stubs for Supabase's `auth` and `storage`. 42 scenarios passed as real `authenticated` and `service_role` sessions, covering:
  - the window, tags, double-blind reveal and the 6-month update;
  - the threshold, the 36-month window and opt-out;
  - the batch grant, deletion, retention and the block hook.

## Handoff to testing

- Apply `20261016000000` and `20261016000100` on staging, redeploy the `recommendations` function, set `NEXT_PUBLIC_PRIVACY_CONTACT`, and run `npm run test:integration` (with `SUPABASE_TEST_ADMIN_*` for the third-party check).
- Manual check with four accounts:
  - three people rate the same person: below 3, the card shows "Še ni dovolj ocen"; from 3, the ratio and strengths;
  - the rated person's `/profile` shows the improvements;
  - turn the toggle off and check "Ocene so skrite";
  - edit a hidden rating;
  - delete a rater's account, and check that the aggregate stays;
  - keyboard only, and a screen reader on the form.

## Blocker

There is no staging Supabase project, so neither migration has been applied to a Supabase project, and the Edge Function change is not deployed. The integration suite skips itself without `SUPABASE_TEST_*`. The owner still has to set the contact e-mail and sign off the LIA before ratings go live.

## Test status

- Automated status: Partially covered
- Test files: `tests/roommate-ratings-migration.test.ts`, `tests/ratings.test.ts`, `tests/recommendations.test.ts`, `tests/privacy.test.ts`, `tests/questionnaire-privacy.test.ts`, `tests/cohabitation-migration.test.ts`, `tests/components/chat-rating.test.tsx`, `tests/components/my-ratings-section.test.tsx`, `integration/ratings.int.ts`
- Scenarios covered: listed above. The unit, static and component tests pass. The integration suite is skipped without staging.
- Remaining gaps: the staging run, the Edge Function deployment, and a manual browser check
- Manual testing: Not run unless explicitly requested
