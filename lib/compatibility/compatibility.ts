/**
 * Lifestyle compatibility (Android F11–F13), ported from
 * `CalculateCompatibilityScoreUseCase.kt`:
 *
 *   S(u, v) = Σ wᵢ · simᵢ(u, v) / Σ wᵢ,   simᵢ = 1 − |aᵢ − bᵢ|,   wᵢ = min(w_aᵢ, w_bᵢ)
 *
 * Only statements answered by both users with a positive weight count, so
 * "Ne želim odgovoriti" (weight 0) on either side drops the statement and the
 * result is normalized to 0..1 regardless of how many statements were answered.
 *
 * Kotlin computes in 32-bit `Float`; every step here is rounded with
 * `Math.fround` so percentages match the Android app exactly.
 */
export type CompatibilityAnswer = {
  question_id: string;
  value: number;
  weight: number;
};

const f = Math.fround;

export function compatibilityScore(
  a: readonly CompatibilityAnswer[],
  b: readonly CompatibilityAnswer[],
): number {
  // Kotlin `associateBy`: the last answer for a statement wins.
  const byQuestion = new Map<string, CompatibilityAnswer>();
  for (const answer of b) byQuestion.set(answer.question_id, answer);

  let weightedSum = f(0);
  let weightTotal = f(0);
  for (const answerA of a) {
    const answerB = byQuestion.get(answerA.question_id);
    if (!answerB) continue;
    const weight = f(Math.min(f(answerA.weight), f(answerB.weight)));
    if (!(weight > 0)) continue;
    const similarity = f(
      1 - f(Math.abs(f(f(answerA.value) - f(answerB.value)))),
    );
    weightedSum = f(weightedSum + f(weight * similarity));
    weightTotal = f(weightTotal + weight);
  }
  return weightTotal > 0 ? f(weightedSum / weightTotal) : 0;
}

/** Whole percentage shown in the UI (Kotlin `(score * 100).roundToInt()`). */
export function compatibilityPercent(
  a: readonly CompatibilityAnswer[] | null,
  b: readonly CompatibilityAnswer[],
): number {
  if (!a) return 0;
  return Math.round(f(compatibilityScore(a, b) * 100));
}

/**
 * Scores candidates against the current user and orders them by descending
 * compatibility. The sort is stable (like Kotlin `sortedByDescending`), so
 * equal scores keep the server order and the result is deterministic.
 */
export function rankByCompatibility<
  T extends { answers: readonly CompatibilityAnswer[] },
>(
  myAnswers: readonly CompatibilityAnswer[] | null,
  candidates: readonly T[],
): Array<{ candidate: T; compatibility: number }> {
  return candidates
    .map((candidate) => ({
      candidate,
      compatibility: compatibilityPercent(myAnswers, candidate.answers),
    }))
    .sort((left, right) => right.compatibility - left.compatibility);
}
