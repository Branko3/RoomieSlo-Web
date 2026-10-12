import { describe, expect, it, vi } from "vitest";
import {
  answersFromStored,
  expressedCount,
  isExpressed,
  levelFromStored,
  LIKERT,
  rowsForSave,
  STATEMENTS,
  type AnswerRow,
  type StoredAnswer,
} from "../lib/questionnaire/model";
import {
  destinationAfterSave,
  loadMyAnswers,
  QuestionnaireError,
  questionnaireErrorMessages,
  saveMyAnswers,
  type QuestionnaireClient,
} from "../lib/questionnaire/persistence";

const USER = "user-1";

describe("questionnaire statements (Android Vprasalnik parity)", () => {
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

  it("has weights summing to 1 and ordered from highest to lowest", () => {
    const weights = STATEMENTS.map((s) => s.weight);
    expect(weights.reduce((sum, w) => sum + w, 0)).toBeCloseTo(1, 4);
    expect([...weights].sort((a, b) => b - a)).toEqual(weights);
  });

  it("has unique ids", () => {
    expect(new Set(STATEMENTS.map((s) => s.id)).size).toBe(STATEMENTS.length);
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
});

describe("levelFromStored", () => {
  it("maps weight 0 (or negative/NaN) to 'prefer not to answer'", () => {
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

  it("resolves exact midpoints to the lower level like Kotlin minBy", () => {
    expect(levelFromStored(0.125, 0.1)).toBe("strongly_disagree");
    expect(levelFromStored(0.625, 0.1)).toBe("neutral");
  });
});

describe("answersFromStored", () => {
  it("restores saved answers and leaves missing statements unselected", () => {
    const answers = answersFromStored([
      { question_id: "q_noise", value: 0.75, weight: 0.0927 },
      { question_id: "q_pets", value: 0.5, weight: 0 },
      { question_id: "q_removed_in_old_version", value: 1, weight: 1 },
    ]);
    expect(answers).toEqual({ q_noise: "agree", q_pets: "no_answer" });
    expect(answers.q_cleanliness).toBeUndefined();
  });
});

describe("rowsForSave", () => {
  it("writes one row per statement with weight = statement weight × multiplier", () => {
    const rows = rowsForSave(USER, {
      q_cleanliness: "strongly_agree",
      q_smoking: "strongly_disagree",
      q_pets: "no_answer",
    });
    expect(rows).toHaveLength(STATEMENTS.length);
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

  it("saves unselected statements as 'prefer not to answer' (skip semantics)", () => {
    const rows = rowsForSave(USER, {});
    expect(rows.every((r) => r.value === 0.5 && r.weight === 0)).toBe(true);
    expect(rows.map((r) => r.question_id)).toEqual(STATEMENTS.map((s) => s.id));
  });

  it("round-trips through storage without changing answers", () => {
    const answers = {
      q_cleanliness: "agree",
      q_costs: "no_answer",
      q_wake: "strongly_disagree",
    } as const;
    const restored = answersFromStored(rowsForSave(USER, answers));
    expect(restored).toMatchObject(answers);
    expect(restored.q_noise).toBe("no_answer");
  });
});

describe("expressedCount", () => {
  it("counts only expressed answers", () => {
    expect(expressedCount({})).toBe(0);
    expect(
      expressedCount({
        q_noise: "agree",
        q_pets: "no_answer",
        q_wake: "neutral",
      }),
    ).toBe(2);
  });
});

function makeClient({
  user = { id: USER } as { id: string } | null,
  rows = [] as StoredAnswer[],
  selectError = null as unknown,
  upsertResult = { error: null } as { error: unknown } | Error,
} = {}) {
  const select = vi.fn();
  const eq = vi.fn();
  const upsert = vi.fn();
  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user }, error: null })) },
    from: vi.fn(() => ({
      select: (columns: string) => {
        select(columns);
        return {
          eq: (column: string, value: string) => {
            eq(column, value);
            return Promise.resolve({ data: rows, error: selectError });
          },
        };
      },
      upsert: (data: AnswerRow[], options: { onConflict: string }) => {
        upsert(data, options);
        return upsertResult instanceof Error
          ? Promise.reject(upsertResult)
          : Promise.resolve(upsertResult);
      },
    })),
  };
  return {
    client: client as unknown as QuestionnaireClient,
    select,
    eq,
    upsert,
  };
}

describe("loadMyAnswers", () => {
  it("loads only the current user's rows", async () => {
    const { client, select, eq } = makeClient({
      rows: [{ question_id: "q_noise", value: 1, weight: 0.0927 }],
    });
    await expect(loadMyAnswers(client)).resolves.toEqual({
      userId: USER,
      answers: { q_noise: "strongly_agree" },
    });
    expect(select).toHaveBeenCalledWith("question_id,value,weight");
    expect(eq).toHaveBeenCalledWith("profile_id", USER);
  });

  it("reports a signed-out user", async () => {
    const { client } = makeClient({ user: null });
    await expect(loadMyAnswers(client)).rejects.toMatchObject({
      kind: "signed-out",
    });
  });

  it("maps a database error to a safe message", async () => {
    const { client } = makeClient({
      selectError: { code: "XX000", message: "internal detail" },
    });
    const error = await loadMyAnswers(client).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(QuestionnaireError);
    expect((error as Error).message).toBe(questionnaireErrorMessages.unknown);
  });
});

describe("saveMyAnswers", () => {
  it("upserts all statements in one request keyed by profile and question", async () => {
    const { client, upsert } = makeClient();
    await saveMyAnswers(client, USER, { q_noise: "agree" });
    expect(upsert).toHaveBeenCalledOnce();
    const [rows, options] = upsert.mock.calls[0];
    expect(rows).toEqual(rowsForSave(USER, { q_noise: "agree" }));
    expect(options).toEqual({ onConflict: "profile_id,question_id" });
  });

  it.each([
    [{ error: { code: "42501" } }, "permission"],
    [{ error: { status: 403 } }, "permission"],
    [new TypeError("Failed to fetch"), "offline"],
    [{ error: { code: "23502", message: "null value" } }, "unknown"],
  ])("maps %o to %s", async (result, kind) => {
    const { client } = makeClient({ upsertResult: result });
    await expect(saveMyAnswers(client, USER, {})).rejects.toMatchObject({
      kind,
    });
  });
});

describe("destinationAfterSave", () => {
  it("returns to the profile by default and to listings after onboarding", () => {
    expect(destinationAfterSave(null)).toBe("/profile");
    expect(destinationAfterSave("profile")).toBe("/profile");
    expect(destinationAfterSave("onboarding")).toBe("/listings");
    expect(destinationAfterSave("https://evil.example")).toBe("/profile");
  });
});
