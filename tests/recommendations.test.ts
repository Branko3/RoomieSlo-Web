import { describe, expect, it, vi } from "vitest";
import {
  compatibilityPercent,
  compatibilityScore,
  rankByCompatibility,
  scoreCandidates,
  type CompatibilityAnswer,
} from "../lib/compatibility/compatibility";
import {
  loadRecommendations,
  nameAndAge,
  type RecommendationsClient,
} from "../lib/matching/recommendations";

const answer = (
  question_id: string,
  value: number,
  weight = 0.1,
): CompatibilityAnswer => ({
  question_id,
  value,
  weight,
});

describe("compatibilityScore (Android CalculateCompatibilityScoreUseCase parity)", () => {
  it("gives the highest score for equal answers", () => {
    const a = [answer("q1", 0.75), answer("q2", 0.25)];
    expect(compatibilityScore(a, a)).toBe(1);
  });

  it("gives the lowest score for opposite answers", () => {
    expect(
      compatibilityScore(
        [answer("q1", 0), answer("q2", 1)],
        [answer("q1", 1), answer("q2", 0)],
      ),
    ).toBe(0);
  });

  it("ignores statements answered by only one user", () => {
    expect(
      compatibilityScore(
        [answer("q1", 1), answer("only-a", 0)],
        [answer("q1", 1), answer("only-b", 1)],
      ),
    ).toBe(1);
  });

  it("ignores statements where either side chose 'prefer not to answer' (weight 0)", () => {
    expect(
      compatibilityScore(
        [answer("q1", 1), answer("q2", 0.5, 0)],
        [answer("q1", 1), answer("q2", 0, 0.1)],
      ),
    ).toBe(1);
    expect(
      compatibilityScore([answer("q2", 0.5, 0.1)], [answer("q2", 0, 0)]),
    ).toBe(0);
  });

  it("uses the smaller of the two weights", () => {
    // q1 equal with weight min(0.3, 0.1) = 0.1; q2 opposite with weight 0.2.
    const score = compatibilityScore(
      [answer("q1", 1, 0.3), answer("q2", 0, 0.2)],
      [answer("q1", 1, 0.1), answer("q2", 1, 0.2)],
    );
    expect(score).toBeCloseTo(0.1 / 0.3, 6);
  });

  it("lets higher-weight statements affect the result more strongly", () => {
    const me = [answer("heavy", 1, 0.9), answer("light", 1, 0.1)];
    const agreesOnHeavy = [answer("heavy", 1, 0.9), answer("light", 0, 0.1)];
    const agreesOnLight = [answer("heavy", 0, 0.9), answer("light", 1, 0.1)];
    expect(compatibilityScore(me, agreesOnHeavy)).toBeGreaterThan(
      compatibilityScore(me, agreesOnLight),
    );
  });

  it("normalizes regardless of how many statements were answered", () => {
    const one = compatibilityScore([answer("q1", 0.75)], [answer("q1", 0.25)]);
    const many = compatibilityScore(
      ["q1", "q2", "q3", "q4"].map((q) => answer(q, 0.75)),
      ["q1", "q2", "q3", "q4"].map((q) => answer(q, 0.25)),
    );
    expect(one).toBe(0.5);
    expect(many).toBe(0.5);
  });

  it("returns 0 with no shared statements", () => {
    expect(compatibilityScore([], [])).toBe(0);
    expect(compatibilityScore([answer("q1", 1)], [answer("q2", 1)])).toBe(0);
  });

  it("uses the last answer when the other profile repeats a statement (associateBy)", () => {
    expect(
      compatibilityScore([answer("q1", 1)], [answer("q1", 0), answer("q1", 1)]),
    ).toBe(1);
  });

  it("computes in 32-bit floats like Kotlin", () => {
    const score = compatibilityScore(
      [answer("q1", 0.75, 0.1056), answer("q2", 0.25, 0.0731)],
      [answer("q1", 0.5, 0.1056), answer("q2", 1, 0.0731)],
    );
    expect(score).toBe(Math.fround(score));
  });
});

describe("compatibilityPercent", () => {
  it("rounds to a whole percentage like Kotlin roundToInt", () => {
    expect(
      compatibilityPercent([answer("q1", 0.75)], [answer("q1", 0.5)]),
    ).toBe(75);
    // 0.125 → 87.5 % rounds half up to 88.
    expect(compatibilityPercent([answer("q1", 0.875)], [answer("q1", 1)])).toBe(
      88,
    );
  });

  it("is 0 when the current user has no profile", () => {
    expect(compatibilityPercent(null, [answer("q1", 1)])).toBe(0);
  });
});

describe("rankByCompatibility", () => {
  const me = [answer("q1", 1)];
  const candidate = (id: string, value: number) => ({
    id,
    answers: [answer("q1", value)],
  });

  it("orders candidates by descending compatibility", () => {
    const ranked = rankByCompatibility(me, [
      candidate("low", 0),
      candidate("high", 1),
      candidate("mid", 0.5),
    ]);
    expect(ranked.map((r) => [r.candidate.id, r.compatibility])).toEqual([
      ["high", 100],
      ["mid", 50],
      ["low", 0],
    ]);
  });

  it("keeps the server order for equal scores (stable, deterministic)", () => {
    const ranked = rankByCompatibility(me, [
      candidate("b", 0.5),
      candidate("a", 0.5),
      candidate("c", 0.5),
    ]);
    expect(ranked.map((r) => r.candidate.id)).toEqual(["b", "a", "c"]);
  });

  it("scores everyone 0 without the user's own profile, keeping server order", () => {
    const ranked = rankByCompatibility(null, [
      candidate("b", 1),
      candidate("a", 0),
    ]);
    expect(ranked.map((r) => [r.candidate.id, r.compatibility])).toEqual([
      ["b", 0],
      ["a", 0],
    ]);
  });
});

describe("nameAndAge", () => {
  it("formats like Android imeInStarost", () => {
    expect(nameAndAge({ displayName: "Ana K.", age: 22 })).toBe("Ana K., 22");
    expect(nameAndAge({ displayName: "Ana K.", age: null })).toBe("Ana K.");
  });
});

describe("scoreCandidates (what the server returns)", () => {
  const me = [answer("q1", 1), answer("q2", 0)];
  const person = (id: string, answers: CompatibilityAnswer[]) => ({
    id,
    displayName: `Oseba ${id}`,
    answers,
  });

  it("ranks like rankByCompatibility and never returns the candidates' answers", () => {
    const scored = scoreCandidates(me, [
      person("low", [answer("q1", 0)]),
      person("high", [answer("q1", 1), answer("q2", 0)]),
    ]);
    expect(scored).toEqual([
      {
        profile: { id: "high", displayName: "Oseba high" },
        compatibility: 100,
        sharedStatements: 2,
      },
      {
        profile: { id: "low", displayName: "Oseba low" },
        compatibility: 0,
        sharedStatements: 1,
      },
    ]);
    expect(JSON.stringify(scored)).not.toContain("question_id");
  });

  it("counts no shared statements when either side skipped them", () => {
    const [only] = scoreCandidates(me, [
      person("skip", [answer("q1", 1, 0), answer("q3", 1)]),
    ]);
    expect(only.sharedStatements).toBe(0);
    expect(only.compatibility).toBe(0);
  });
});

function makeClient({
  user = { id: "me" } as { id: string } | null,
  invoke = {
    data: { myAnswers: [answer("q1", 1)], recommendations: [] },
    error: null,
  } as { data: unknown; error: unknown } | Error,
} = {}) {
  const calls: string[] = [];
  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user }, error: null })) },
    functions: {
      invoke: vi.fn(async (name: string) => {
        calls.push(name);
        if (invoke instanceof Error) throw invoke;
        return invoke;
      }),
    },
  };
  return { client: client as unknown as RecommendationsClient, calls };
}

const recommendation = (id: string, compatibility: number) => ({
  profile: {
    id,
    displayName: `Oseba ${id}`,
    verified: false,
    available: true,
    age: null,
    faculty: "",
    bio: "",
  },
  compatibility,
  sharedStatements: 1,
  ratings: null as unknown,
});

describe("loadRecommendations", () => {
  it("validates each person's rating summary and keeps rater identities out", async () => {
    const shown = {
      state: "shown",
      total: 4,
      would_live_again: 3,
      strengths: [{ tag: "clean_tidy", count: 3 }],
    };
    const result = {
      myAnswers: [answer("q1", 1)],
      recommendations: [
        { ...recommendation("a", 90), ratings: shown },
        { ...recommendation("b", 80), ratings: { state: "insufficient" } },
        { ...recommendation("c", 70), ratings: { state: "hidden" } },
        { ...recommendation("d", 60), ratings: undefined },
      ],
    };
    const loaded = await loadRecommendations(
      makeClient({ invoke: { data: result, error: null } }).client,
    );
    expect(loaded.recommendations.map((r) => r.ratings)).toEqual([
      {
        state: "shown",
        total: 4,
        wouldLiveAgain: 3,
        strengths: [{ tag: "clean_tidy", count: 3 }],
      },
      { state: "insufficient" },
      { state: "hidden" },
      null,
    ]);
  });

  it.each([
    ["an unknown state", { state: "great" }],
    [
      "fewer than 3 shown ratings",
      { state: "shown", total: 2, would_live_again: 2, strengths: [] },
    ],
    [
      "private improvements",
      {
        state: "shown",
        total: 3,
        would_live_again: 1,
        strengths: [{ tag: "noise", count: 1 }],
      },
    ],
    [
      "more than 3 strengths",
      {
        state: "shown",
        total: 5,
        would_live_again: 5,
        strengths: [
          "clean_tidy",
          "pleasant",
          "respects_quiet",
          "keeps_agreements",
        ].map((tag) => ({ tag, count: 1 })),
      },
    ],
  ])(
    "drops only that card's summary when it has %s",
    async (_label, ratings) => {
      const loaded = await loadRecommendations(
        makeClient({
          invoke: {
            data: {
              myAnswers: [],
              recommendations: [
                { ...recommendation("a", 1), ratings },
                { ...recommendation("b", 1), ratings: { state: "hidden" } },
              ],
            },
            error: null,
          },
        }).client,
      );
      expect(
        loaded.recommendations.map((r) => [r.profile.id, r.ratings]),
      ).toEqual([
        ["a", null],
        ["b", { state: "hidden" }],
      ]);
    },
  );

  it("asks the recommendations function, never the answers table", async () => {
    const result = {
      myAnswers: [answer("q1", 1)],
      recommendations: [recommendation("b", 100), recommendation("a", 0)],
    };
    const { client, calls } = makeClient({
      invoke: { data: result, error: null },
    });
    await expect(loadRecommendations(client)).resolves.toEqual(result);
    expect(calls).toEqual(["recommendations"]);
    expect(client).not.toHaveProperty("from");
  });

  it("requires a signed-in user", async () => {
    const { client, calls } = makeClient({ user: null });
    await expect(loadRecommendations(client)).rejects.toMatchObject({
      kind: "signed-out",
    });
    expect(calls).toEqual([]);
  });

  it("maps the function's 401 to signed-out", async () => {
    await expect(
      loadRecommendations(
        makeClient({
          invoke: {
            data: null,
            error: { name: "FunctionsHttpError", context: { status: 401 } },
          },
        }).client,
      ),
    ).rejects.toMatchObject({ kind: "signed-out" });
  });

  it("maps network and server failures to safe messages", async () => {
    await expect(
      loadRecommendations(
        makeClient({ invoke: new TypeError("Failed to fetch") }).client,
      ),
    ).rejects.toMatchObject({ kind: "offline" });
    await expect(
      loadRecommendations(
        makeClient({
          invoke: {
            data: null,
            error: { name: "FunctionsFetchError", message: "Failed to send" },
          },
        }).client,
      ),
    ).rejects.toMatchObject({ kind: "offline" });
    await expect(
      loadRecommendations(
        makeClient({
          invoke: {
            data: null,
            error: { name: "FunctionsHttpError", context: { status: 500 } },
          },
        }).client,
      ),
    ).rejects.toMatchObject({
      kind: "unknown",
      message: "Napaka pri nalaganju priporočil.",
    });
  });

  it("rejects a malformed response instead of rendering it", async () => {
    await expect(
      loadRecommendations(
        makeClient({
          invoke: { data: { recommendations: "nope" }, error: null },
        }).client,
      ),
    ).rejects.toMatchObject({ kind: "unknown" });
  });
});
