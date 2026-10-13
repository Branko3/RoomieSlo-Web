import type { CompatibilityAnswer } from "../compatibility/compatibility";

/**
 * Minimum number of expressed questionnaire answers before recommendations are
 * shown. With fewer, a single answer would decide the whole ranking (the score
 * is normalized by the answered weight), so the list would look precise
 * without being meaningful.
 */
export const MIN_EXPRESSED_ANSWERS = 3;

export const QUESTIONNAIRE_ROUTE = "/profile/questionnaire";

/** Statements the user actually answered ("Ne želim odgovoriti" has weight 0). */
export function expressedAnswerCount(
  answers: readonly CompatibilityAnswer[] | null,
): number {
  if (!answers) return 0;
  return new Set(answers.filter((a) => a.weight > 0).map((a) => a.question_id))
    .size;
}

export { sharedStatementCount } from "../compatibility/compatibility";

export type RecommendationReadiness =
  | { status: "ready" }
  | { status: "no-answers" }
  | { status: "insufficient"; answered: number; required: number };

/** Decides whether the user has answered enough to see compatibility-ranked recommendations. */
export function recommendationReadiness(
  myAnswers: readonly CompatibilityAnswer[] | null,
  required: number = MIN_EXPRESSED_ANSWERS,
): RecommendationReadiness {
  const answered = expressedAnswerCount(myAnswers);
  if (answered === 0) return { status: "no-answers" };
  if (answered < required)
    return { status: "insufficient", answered, required };
  return { status: "ready" };
}

/** Slovenian plural for "trditev" (1 trditev, 2 trditvi, 3–4 trditve, 5+ trditev). */
export function statementsLabel(count: number): string {
  const mod100 = count % 100;
  if (mod100 === 1) return `${count} trditev`;
  if (mod100 === 2) return `${count} trditvi`;
  if (mod100 === 3 || mod100 === 4) return `${count} trditve`;
  return `${count} trditev`;
}

export function readinessMessage(readiness: RecommendationReadiness): {
  title: string;
  body: string;
} | null {
  if (readiness.status === "ready") return null;
  if (readiness.status === "no-answers") {
    return {
      title: "Najprej izpolni vprašalnik",
      body: `Priporočila razvrstimo po združljivosti tvojih odgovorov. Odgovori na vsaj ${statementsLabel(MIN_EXPRESSED_ANSWERS)} o življenjskem slogu.`,
    };
  }
  const missing = readiness.required - readiness.answered;
  return {
    title: "Za priporočila potrebujemo več odgovorov",
    body: `Odgovoril(a) si na ${statementsLabel(readiness.answered)}. Odgovori še na ${statementsLabel(missing)}, da bodo ocene združljivosti zanesljive.`,
  };
}
