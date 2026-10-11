/**
 * Lifestyle questionnaire (Android F04), ported from `domain/model/Vprasalnik.kt`.
 *
 * Statement ids are keys of `questionnaire_answers` rows and must never change.
 * Weights come from a survey of students in Slovenia (n = 43, July 2026) and
 * sum to 1.0; statements are ordered from the highest weight down so that a
 * user who skips early has still answered the most important ones.
 */
export type Statement = { id: string; text: string; weight: number };

export const STATEMENTS: readonly Statement[] = [
  {
    id: "q_cleanliness",
    text: "Skupni prostori morajo biti vedno pospravljeni.",
    weight: 0.1056,
  },
  {
    id: "q_costs",
    text: "Svoj del stroškov poravnam do dogovorjenega roka.",
    weight: 0.1056,
  },
  { id: "q_smoking", text: "Kajenje v stanovanju me ne moti.", weight: 0.1007 },
  {
    id: "q_parties",
    text: "Občasne zabave v stanovanju me ne motijo.",
    weight: 0.0977,
  },
  { id: "q_noise", text: "Zvečer imam rad(a) mir in tišino.", weight: 0.0927 },
  {
    id: "q_chores",
    text: "Gospodinjska opravila naj bodo razdeljena po dogovorjenem razporedu.",
    weight: 0.0906,
  },
  {
    id: "q_guests",
    text: "Vesel(a) sem, če so v stanovanju pogosto obiski.",
    weight: 0.0866,
  },
  {
    id: "q_pets",
    text: "V stanovanju bi rad(a) imel(a) hišnega ljubljenčka.",
    weight: 0.0843,
  },
  {
    id: "q_study",
    text: "Doma se pogosto učim in takrat potrebujem mir.",
    weight: 0.083,
  },
  {
    id: "q_overnight",
    text: "Ne moti me, če gostje ali partner(ka) prespijo v stanovanju.",
    weight: 0.0801,
  },
  {
    id: "q_wake",
    text: "Zjutraj vstajam zgodaj in zvečer hodim zgodaj spat.",
    weight: 0.0731,
  },
];

/**
 * Likert levels (Android `LikertOdgovor`). `value` is normalized to 0..1 for
 * the compatibility formula `1 - |a - b|`; `multiplier` is 0 only for
 * "prefer not to answer", which is stored with weight 0 so it never affects
 * compatibility while every statement still has a row.
 */
export const LIKERT = [
  {
    key: "strongly_disagree",
    label: "Sploh se ne strinjam",
    value: 0,
    multiplier: 1,
  },
  { key: "disagree", label: "Se ne strinjam", value: 0.25, multiplier: 1 },
  { key: "neutral", label: "Niti da niti ne", value: 0.5, multiplier: 1 },
  { key: "agree", label: "Se strinjam", value: 0.75, multiplier: 1 },
  {
    key: "strongly_agree",
    label: "Popolnoma se strinjam",
    value: 1,
    multiplier: 1,
  },
  { key: "no_answer", label: "Ne želim odgovoriti", value: 0.5, multiplier: 0 },
] as const;

export type LikertKey = (typeof LIKERT)[number]["key"];
export type LikertLevel = (typeof LIKERT)[number];
export type Answers = Partial<Record<string, LikertKey>>;
export type StoredAnswer = {
  question_id: string;
  value: number;
  weight: number;
};
export type AnswerRow = StoredAnswer & { profile_id: string };

const LEVELS = new Map<LikertKey, LikertLevel>(
  LIKERT.map((level) => [level.key, level]),
);

export function likertLevel(key: LikertKey): LikertLevel {
  const level = LEVELS.get(key);
  if (!level) throw new Error(`Unknown Likert level ${key}`);
  return level;
}

export function isExpressed(key: LikertKey): boolean {
  return likertLevel(key).multiplier > 0;
}

/**
 * Maps a stored answer back to a Likert level (Android `izVrednosti`): weight 0
 * means "prefer not to answer"; otherwise the nearest expressed level, because
 * an earlier questionnaire version used a continuous slider.
 */
export function levelFromStored(value: number, weight: number): LikertKey {
  if (!(weight > 0)) return "no_answer";
  let best: LikertLevel = LIKERT[0];
  for (const level of LIKERT) {
    if (
      level.multiplier > 0 &&
      Math.abs(level.value - value) < Math.abs(best.value - value)
    ) {
      best = level;
    }
  }
  return best.key;
}

/**
 * Restores saved answers. Statements without a stored row stay unselected so a
 * default never looks like the user's own choice; rows for unknown ids are ignored.
 */
export function answersFromStored(rows: readonly StoredAnswer[]): Answers {
  const known = new Set(STATEMENTS.map((statement) => statement.id));
  const answers: Answers = {};
  for (const row of rows) {
    if (known.has(row.question_id)) {
      answers[row.question_id] = levelFromStored(row.value, row.weight);
    }
  }
  return answers;
}

/**
 * Builds one row per statement for saving. Unselected statements are saved as
 * "prefer not to answer" (weight 0). Skipping uses exactly the same save.
 */
export function rowsForSave(profileId: string, answers: Answers): AnswerRow[] {
  return STATEMENTS.map((statement) => {
    const level = likertLevel(answers[statement.id] ?? "no_answer");
    return {
      profile_id: profileId,
      question_id: statement.id,
      value: level.value,
      weight: statement.weight * level.multiplier,
    };
  });
}

/** Number of statements where the user expressed a level (Android `steviloIzrecenih`). */
export function expressedCount(answers: Answers): number {
  return STATEMENTS.filter((statement) => {
    const key = answers[statement.id];
    return key !== undefined && isExpressed(key);
  }).length;
}
