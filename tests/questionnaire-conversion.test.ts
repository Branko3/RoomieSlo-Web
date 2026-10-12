import { describe, expect, it } from "vitest";
import {
  answersFromStored,
  expressedCount,
  isExpressed,
  levelFromStored,
  LIKERT,
  likertLevel,
  rowsForSave,
  STATEMENTS,
  type Answers,
} from "../lib/questionnaire/model";

const USER = "user-1";

describe("statements (Android Vprasalnik parity)", () => {
  it("keeps the Android ids, order, and survey weights", () => {
    expect(STATEMENTS.map((s) => [s.id, s.weight])).toEqual([
      ["q_cleanliness", 0.1056],
      ["q_costs", 0.1056],
      ["q_smoking", 0.1007],
      ["q_parties", 0.0977],
      ["q_noise", 0.0927],
      ["q_chores", 0.0906],
      ["q_guests", 0.0866],
      ["q_pets", 0.0843],
      ["q_study", 0.083],
      ["q_overnight", 0.0801],
      ["q_wake", 0.0731],
    ]);
  });

  it("has unique ids, weights summing to 1, and descending weight order", () => {
    const weights = STATEMENTS.map((s) => s.weight);
    expect(new Set(STATEMENTS.map((s) => s.id)).size).toBe(STATEMENTS.length);
    expect(weights.reduce((sum, w) => sum + w, 0)).toBeCloseTo(1, 4);
    expect([...weights].sort((a, b) => b - a)).toEqual(weights);
  });
});

describe("Likert levels (Android LikertOdgovor parity)", () => {
  it("maps labels to normalized values and multipliers", () => {
    expect(LIKERT.map((l) => [l.label, l.value, l.multiplier])).toEqual([
      ["Sploh se ne strinjam", 0, 1],
      ["Se ne strinjam", 0.25, 1],
      ["Niti da niti ne", 0.5, 1],
      ["Se strinjam", 0.75, 1],
      ["Popolnoma se strinjam", 1, 1],
      ["Ne želim odgovoriti", 0.5, 0],
    ]);
  });

  it("treats only 'prefer not to answer' as unexpressed", () => {
    expect(LIKERT.filter((l) => !isExpressed(l.key)).map((l) => l.key)).toEqual(
      ["no_answer"],
    );
  });

  it("rejects unknown level keys", () => {
    expect(() => likertLevel("maybe" as never)).toThrow();
  });
});

describe("conversion from stored rows", () => {
  it("maps weight 0, negative, and NaN weights to 'prefer not to answer'", () => {
    expect(levelFromStored(1, 0)).toBe("no_answer");
    expect(levelFromStored(0.75, -1)).toBe("no_answer");
    expect(levelFromStored(0.75, Number.NaN)).toBe("no_answer");
  });

  it.each([
    [0, "strongly_disagree"],
    [0.25, "disagree"],
    [0.5, "neutral"],
    [0.75, "agree"],
    [1, "strongly_agree"],
  ])("restores exact value %d as %s", (value, key) => {
    expect(levelFromStored(value, 0.1)).toBe(key);
  });

  it.each([
    [0.1, "strongly_disagree"],
    [0.3, "disagree"],
    [0.62, "neutral"],
    [0.9, "strongly_agree"],
    [1.4, "strongly_agree"],
    [-0.2, "strongly_disagree"],
  ])("snaps legacy slider value %d to the nearest level %s", (value, key) => {
    expect(levelFromStored(value, 0.1)).toBe(key);
  });

  it("never restores a weighted row as 'prefer not to answer'", () => {
    for (let value = -0.5; value <= 1.5; value += 0.05) {
      expect(levelFromStored(value, 0.05)).not.toBe("no_answer");
    }
  });

  it("resolves exact midpoints to the lower level like Kotlin minBy", () => {
    expect(levelFromStored(0.125, 0.1)).toBe("strongly_disagree");
    expect(levelFromStored(0.625, 0.1)).toBe("neutral");
  });

  it("leaves statements without a row unselected and ignores unknown ids", () => {
    const answers = answersFromStored([
      { question_id: "q_noise", value: 0.75, weight: 0.0927 },
      { question_id: "q_pets", value: 0.5, weight: 0 },
      { question_id: "q_removed_in_old_version", value: 1, weight: 1 },
    ]);
    expect(answers).toEqual({ q_noise: "agree", q_pets: "no_answer" });
  });

  it("uses the last row when an id appears twice, like Kotlin associateBy", () => {
    expect(
      answersFromStored([
        { question_id: "q_noise", value: 0, weight: 0.0927 },
        { question_id: "q_noise", value: 1, weight: 0.0927 },
      ]),
    ).toEqual({ q_noise: "strongly_agree" });
  });
});

describe("conversion to rows for saving", () => {
  it("writes weight = statement weight × multiplier and the level value", () => {
    const rows = rowsForSave(USER, {
      q_cleanliness: "strongly_agree",
      q_smoking: "strongly_disagree",
      q_pets: "no_answer",
    });
    expect(rows[0]).toEqual({
      profile_id: USER,
      question_id: "q_cleanliness",
      value: 1,
      weight: 0.1056,
    });
    expect(rows.find((r) => r.question_id === "q_smoking")).toMatchObject({
      value: 0,
      weight: 0.1007,
    });
    expect(rows.find((r) => r.question_id === "q_pets")).toMatchObject({
      value: 0.5,
      weight: 0,
    });
  });

  it("always writes exactly one row per statement in statement order", () => {
    const rows = rowsForSave(USER, { q_wake: "agree" });
    expect(rows.map((r) => r.question_id)).toEqual(STATEMENTS.map((s) => s.id));
    expect(rows.every((r) => r.profile_id === USER)).toBe(true);
  });

  it("ignores answers for ids that are not statements", () => {
    const rows = rowsForSave(USER, { q_unknown: "agree" } as Answers);
    expect(rows.map((r) => r.question_id)).not.toContain("q_unknown");
    expect(rows.map((r) => r.question_id)).toEqual(STATEMENTS.map((s) => s.id));
    expect(rows.every((r) => r.value === 0.5 && r.weight === 0)).toBe(true);
  });

  it("treats non-finite stored values as unanswered", () => {
    expect(levelFromStored(Number.NaN, 0.1)).toBe("no_answer");
    expect(levelFromStored(Number.POSITIVE_INFINITY, 0.1)).toBe("no_answer");
    expect(levelFromStored(0.75, Number.POSITIVE_INFINITY)).toBe("no_answer");
  });

  it("keeps the statement definitions immutable", () => {
    expect(Object.isFrozen(STATEMENTS)).toBe(true);
    expect(STATEMENTS.every((statement) => Object.isFrozen(statement))).toBe(
      true,
    );
  });
});

describe("skip semantics", () => {
  it("skipping immediately saves every statement as 'prefer not to answer'", () => {
    const rows = rowsForSave(USER, {});
    expect(rows).toHaveLength(STATEMENTS.length);
    expect(rows.every((r) => r.value === 0.5 && r.weight === 0)).toBe(true);
  });

  it("skipping part-way keeps given answers and zero-weights the rest", () => {
    const answers: Answers = {
      q_cleanliness: "agree",
      q_costs: "strongly_agree",
      q_smoking: "disagree",
    };
    const rows = rowsForSave(USER, answers);
    expect(rows.filter((r) => r.weight > 0).map((r) => r.question_id)).toEqual([
      "q_cleanliness",
      "q_costs",
      "q_smoking",
    ]);
    expect(rows.filter((r) => r.weight === 0)).toHaveLength(8);
    for (const [id, key] of Object.entries(answers)) {
      const row = rows.find((r) => r.question_id === id)!;
      const level = likertLevel(key!);
      const statement = STATEMENTS.find((s) => s.id === id)!;
      expect(row.value).toBe(level.value);
      expect(row.weight).toBe(statement.weight * level.multiplier);
    }
    expect(expressedCount(answers)).toBe(3);
  });

  it("does not count 'prefer not to answer' as completed", () => {
    expect(expressedCount({})).toBe(0);
    expect(
      expressedCount({
        q_noise: "agree",
        q_pets: "no_answer",
        q_wake: "neutral",
      }),
    ).toBe(2);
  });

  it("restores a skipped questionnaire as explicit 'prefer not to answer' choices", () => {
    const restored = answersFromStored(rowsForSave(USER, {}));
    expect(Object.values(restored)).toHaveLength(STATEMENTS.length);
    expect(Object.values(restored).every((key) => key === "no_answer")).toBe(
      true,
    );
    expect(expressedCount(restored)).toBe(0);
  });

  it("round-trips every level through storage unchanged", () => {
    for (const level of LIKERT) {
      const restored = answersFromStored(
        rowsForSave(USER, { q_study: level.key }),
      );
      expect(restored.q_study).toBe(level.key);
    }
  });
});
