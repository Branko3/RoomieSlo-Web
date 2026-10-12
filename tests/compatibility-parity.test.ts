import { describe, expect, it } from "vitest";
import {
  compatibilityPercent,
  compatibilityScore,
  rankByCompatibility,
  type CompatibilityAnswer,
} from "../lib/compatibility/compatibility";
import {
  rowsForSave,
  STATEMENTS,
  type Answers,
} from "../lib/questionnaire/model";

/**
 * Port of Android `CalculateCompatibilityScoreUseCaseTest.kt`, test by test.
 * Weights are read from the questionnaire (Android reads `Vprasalnik`), so the
 * tests check properties of the formula rather than constants.
 */
const DELTA = 1e-4;

function weight(id: string): number {
  const statement = STATEMENTS.find((s) => s.id === id);
  if (!statement) throw new Error(`Unknown statement ${id}`);
  return statement.weight;
}

/** Profile answers given as statement id → normalized value (Android `profil`). */
function profile(...answers: Array<[string, number]>): CompatibilityAnswer[] {
  return answers.map(([question_id, value]) => ({
    question_id,
    value,
    weight: weight(question_id),
  }));
}

function expectClose(actual: number, expected: number) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(DELTA);
}

describe("Android CalculateCompatibilityScoreUseCaseTest (ported)", () => {
  it("popolnoma enaki odgovori dajo najvisjo oceno", () => {
    const a = profile(["q_cleanliness", 1], ["q_noise", 0.25], ["q_wake", 0.5]);
    const b = profile(["q_cleanliness", 1], ["q_noise", 0.25], ["q_wake", 0.5]);
    expectClose(compatibilityScore(a, b), 1);
  });

  it("popolnoma nasprotni odgovori dajo najnizjo oceno", () => {
    const a = profile(["q_cleanliness", 1], ["q_smoking", 0]);
    const b = profile(["q_cleanliness", 0], ["q_smoking", 1]);
    expectClose(compatibilityScore(a, b), 0);
  });

  it("brez skupne odgovorjene trditve je ocena nic", () => {
    expectClose(
      compatibilityScore(
        profile(["q_cleanliness", 1]),
        profile(["q_smoking", 1]),
      ),
      0,
    );
  });

  it("trditev, na katero je odgovoril le en uporabnik, se ne steje", () => {
    const a = profile(["q_cleanliness", 1], ["q_smoking", 0]);
    const b = profile(["q_cleanliness", 1]);
    expectClose(compatibilityScore(a, b), 1);
  });

  it("neizrecen odgovor izloci trditev ne glede na to, kdo ga ni podal", () => {
    const neizrecen = { question_id: "q_cleanliness", value: 0.5, weight: 0 };
    const izrecen = {
      question_id: "q_cleanliness",
      value: 1,
      weight: weight("q_cleanliness"),
    };
    const ujemanje = {
      question_id: "q_wake",
      value: 0.5,
      weight: weight("q_wake"),
    };
    const a = [izrecen, ujemanje];
    const b = [neizrecen, ujemanje];

    expectClose(compatibilityScore(a, b), 1);
    // The formula is symmetric: profile order does not matter.
    expectClose(compatibilityScore(a, b), compatibilityScore(b, a));
  });

  it("neujemanje pri trditvi z vecjo utezjo bolj znizza oceno", () => {
    const visoka = "q_cleanliness";
    const nizka = "q_wake";
    const ocenaVisokaUjema = compatibilityScore(
      profile([visoka, 1], [nizka, 1]),
      profile([visoka, 1], [nizka, 0]),
    );
    const ocenaVisokaNeUjema = compatibilityScore(
      profile([visoka, 1], [nizka, 1]),
      profile([visoka, 0], [nizka, 1]),
    );
    expect(ocenaVisokaUjema).toBeGreaterThan(ocenaVisokaNeUjema);
    // Together the two scores cover the full weight of both statements.
    expectClose(ocenaVisokaUjema + ocenaVisokaNeUjema, 1);
  });

  it("ocena je normalizirana ne glede na stevilo odgovorjenih trditev", () => {
    const one = compatibilityScore(
      profile(["q_cleanliness", 1]),
      profile(["q_cleanliness", 0.75]),
    );
    const all = STATEMENTS.map((s) => s.id);
    const many = compatibilityScore(
      profile(...all.map((id) => [id, 1] as [string, number])),
      profile(...all.map((id) => [id, 0.75] as [string, number])),
    );
    expectClose(one, 0.75);
    expectClose(one, many);
  });
});

/** Independent Float32 reference of the Kotlin loop, used to cross-check the port. */
function kotlinReference(
  a: CompatibilityAnswer[],
  b: CompatibilityAnswer[],
): number {
  const f32 = new Float32Array(1);
  const f = (x: number) => ((f32[0] = x), f32[0]);
  const byQuestion = new Map(b.map((x) => [x.question_id, x]));
  let sum = f(0);
  let total = f(0);
  for (const x of a) {
    const y = byQuestion.get(x.question_id);
    if (!y) continue;
    const w = f(Math.min(f(x.weight), f(y.weight)));
    if (w <= 0) continue;
    sum = f(sum + f(w * f(1 - f(Math.abs(f(f(x.value) - f(y.value)))))));
    total = f(total + w);
  }
  return total > 0 ? f(sum / total) : 0;
}

describe("additional parity checks", () => {
  // Deterministic pseudo-random questionnaires (LCG), including skipped answers.
  function questionnaires(
    seed: number,
    count: number,
  ): CompatibilityAnswer[][] {
    let state = seed;
    const next = () => {
      state = (state * 1103515245 + 12345) % 2147483648;
      return state / 2147483648;
    };
    const levels = [0, 0.25, 0.5, 0.75, 1];
    return Array.from({ length: count }, () =>
      STATEMENTS.filter(() => next() > 0.2).map((s) => {
        const skipped = next() < 0.15;
        return {
          question_id: s.id,
          value: skipped ? 0.5 : levels[Math.floor(next() * levels.length)],
          weight: skipped ? 0 : weight(s.id),
        };
      }),
    );
  }

  it("matches a Float32 reference of the Kotlin loop bit for bit", () => {
    const people = questionnaires(42, 40);
    for (const a of people) {
      for (const b of people) {
        expect(compatibilityScore(a, b)).toBe(kotlinReference(a, b));
      }
    }
  });

  it("stays within 0..1 and gives 100 % only for identical expressed answers", () => {
    const people = questionnaires(7, 30);
    for (const a of people) {
      for (const b of people) {
        const score = compatibilityScore(a, b);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      }
      if (a.some((x) => x.weight > 0))
        expect(compatibilityPercent(a, a)).toBe(100);
    }
  });

  it("works on rows saved by the web questionnaire (skip = weight 0)", () => {
    const me: Answers = {
      q_cleanliness: "strongly_agree",
      q_smoking: "strongly_disagree",
    };
    const other: Answers = { q_cleanliness: "agree", q_smoking: "no_answer" };
    const score = compatibilityScore(
      rowsForSave("me", me),
      rowsForSave("other", other),
    );
    // Only q_cleanliness counts: 1 − |1 − 0.75| = 0.75.
    expectClose(score, 0.75);
    expect(
      compatibilityPercent(rowsForSave("me", me), rowsForSave("other", other)),
    ).toBe(75);
  });

  it("scores a fully skipped questionnaire as 0 % against anyone", () => {
    const skipped = rowsForSave("x", {});
    const answered = rowsForSave("y", { q_cleanliness: "agree" });
    expect(compatibilityPercent(skipped, answered)).toBe(0);
  });

  it("ranks deterministically by descending percentage", () => {
    const me = profile(["q_cleanliness", 1], ["q_noise", 1]);
    const ranked = rankByCompatibility(me, [
      { id: "half", answers: profile(["q_cleanliness", 1], ["q_noise", 0]) },
      { id: "full", answers: profile(["q_cleanliness", 1], ["q_noise", 1]) },
      { id: "none", answers: profile(["q_cleanliness", 0], ["q_noise", 0]) },
      { id: "half-2", answers: profile(["q_cleanliness", 1], ["q_noise", 0]) },
    ]);
    expect(ranked.map((r) => r.candidate.id)).toEqual([
      "full",
      "half",
      "half-2",
      "none",
    ]);
  });
});
