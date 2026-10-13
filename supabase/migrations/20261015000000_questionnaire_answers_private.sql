-- Questionnaire answers are private (closes the `qa_select using (true)` item).
-- Every signed-in user could read everyone's lifestyle answers, because the
-- browser computed compatibility itself. Ranking now runs in the
-- `recommendations` Edge Function with the service role, which returns scores
-- only, so each user needs to read just their own answers.
-- Android's client-side ranking stops seeing other people's answers; the web is
-- the priority (owner decision 2026-10-13), and Android can call the same function.

drop policy if exists qa_select on public.questionnaire_answers;
create policy qa_select on public.questionnaire_answers for select to authenticated
    using (auth.uid() = profile_id);
