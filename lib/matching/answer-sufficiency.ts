import type { CompatibilityAnswer } from "../compatibility/compatibility";
import type { I18n } from "../i18n/i18n";

/**
 * Minimum number of expressed questionnaire answers before recommendations are
 * shown. With fewer, a single answer would decide the whole ranking (the score
 * is normalized by the answered weight), so the list would look precise
 * without being meaningful.
 */
export const MIN_EXPRESSED_ANSWERS = 3;

export const QUESTIONNAIRE_ROUTE = "/profile/questionnaire";

/** Statements the user actually answered ("prefer not to say" has weight 0). */
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

/** The catalog access `readinessMessage` needs: `useI18n()` or `getI18n()`. */
export type ReadinessText = Pick<I18n, "m" | "format" | "plural">;

/** Title and body of the notice shown instead of recommendations; null when ready. */
export function readinessMessage(
  readiness: RecommendationReadiness,
  { m, format, plural }: ReadinessText,
): {
  title: string;
  body: string;
} | null {
  if (readiness.status === "ready") return null;
  const t = m.questionnaire.readiness;
  const statements = (count: number) => plural(t.statements, count);
  if (readiness.status === "no-answers") {
    return {
      title: t.noAnswersTitle,
      body: format(t.noAnswersBody, {
        statements: statements(MIN_EXPRESSED_ANSWERS),
      }),
    };
  }
  const missing = readiness.required - readiness.answered;
  return {
    title: t.insufficientTitle,
    body: format(t.insufficientBody, {
      answered: statements(readiness.answered),
      missing: statements(missing),
    }),
  };
}
