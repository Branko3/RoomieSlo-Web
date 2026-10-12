import { describe, expect, it, vi } from "vitest";
import {
  compatibilityPercent,
  compatibilityScore,
  rankByCompatibility,
  type CompatibilityAnswer,
} from "../lib/compatibility/compatibility";
import {
  loadRecommendations,
  nameAndAge,
  PROFILE_WITH_ANSWERS,
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

type Rows = Array<Record<string, unknown>>;

function makeClient({
  user = { id: "me" } as { id: string } | null,
  mine = [
    {
      id: "me",
      display_name: "Jaz",
      academic_status_verified: true,
      is_available: true,
      age: 22,
      faculty: "FRI",
      bio: "",
      avatar_url: "",
      questionnaire_answers: [answer("q1", 1)],
    },
  ] as Rows,
  candidates = [] as Rows,
  failWith = null as unknown,
} = {}) {
  const queries: Array<Array<[string, unknown[]]>> = [];
  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user }, error: null })) },
    from: vi.fn(() => ({
      select: (columns: string) => {
        const calls: Array<[string, unknown[]]> = [["select", [columns]]];
        queries.push(calls);
        const builder = {
          eq: (column: string, value: unknown) => {
            calls.push(["eq", [column, value]]);
            return builder;
          },
          neq: (column: string, value: unknown) => {
            calls.push(["neq", [column, value]]);
            return builder;
          },
          then: (
            resolve: (v: unknown) => unknown,
            reject: (e: unknown) => unknown,
          ) => {
            if (failWith instanceof Error)
              return Promise.reject(failWith).then(resolve, reject);
            const isMine = calls.some(
              ([name, args]) => name === "eq" && args[0] === "id",
            );
            return Promise.resolve({
              data: isMine ? mine : candidates,
              error: failWith,
            }).then(resolve, reject);
          },
        };
        return builder;
      },
    })),
  };
  return { client: client as unknown as RecommendationsClient, queries };
}

const profile = (
  id: string,
  value: number,
  extra: Record<string, unknown> = {},
) => ({
  id,
  display_name: `Oseba ${id}`,
  academic_status_verified: false,
  is_available: true,
  age: null,
  faculty: "",
  bio: "",
  avatar_url: "",
  questionnaire_answers: [answer("q1", value)],
  ...extra,
});

describe("loadRecommendations", () => {
  it("loads available profiles other than the user with nested answers", async () => {
    const { client, queries } = makeClient();
    await loadRecommendations(client);
    expect(queries).toContainEqual([
      ["select", [PROFILE_WITH_ANSWERS]],
      ["eq", ["is_available", true]],
      ["neq", ["id", "me"]],
    ]);
    expect(queries).toContainEqual([
      ["select", [PROFILE_WITH_ANSWERS]],
      ["eq", ["id", "me"]],
    ]);
    expect(PROFILE_WITH_ANSWERS).toContain(
      "questionnaire_answers(profile_id,question_id,value,weight)",
    );
  });

  it("ranks candidates by compatibility with the user's answers", async () => {
    const { client } = makeClient({
      candidates: [
        profile("a", 0),
        profile("b", 1, { age: 23, faculty: "FF" }),
      ],
    });
    const result = await loadRecommendations(client);
    expect(
      result.recommendations.map((r) => [r.profile.id, r.compatibility]),
    ).toEqual([
      ["b", 100],
      ["a", 0],
    ]);
    expect(result.recommendations[0].profile).toMatchObject({
      displayName: "Oseba b",
      age: 23,
      faculty: "FF",
    });
  });

  it("scores 0 when the user's own profile row is missing", async () => {
    const { client } = makeClient({ mine: [], candidates: [profile("a", 1)] });
    const result = await loadRecommendations(client);
    expect(result.myAnswers).toBeNull();
    expect(result.recommendations[0].compatibility).toBe(0);
  });

  it("fills in safe defaults for missing profile fields", async () => {
    const { client } = makeClient({
      candidates: [
        profile("a", 1, {
          display_name: "  ",
          faculty: null,
          bio: null,
          questionnaire_answers: null,
        }),
      ],
    });
    const [rec] = (await loadRecommendations(client)).recommendations;
    expect(rec.profile).toMatchObject({
      displayName: "Uporabnik",
      faculty: "",
      bio: "",
      answers: [],
    });
    expect(rec.compatibility).toBe(0);
  });

  it("requires a signed-in user", async () => {
    const { client, queries } = makeClient({ user: null });
    await expect(loadRecommendations(client)).rejects.toMatchObject({
      kind: "signed-out",
    });
    expect(queries).toEqual([]);
  });

  it("maps network and server failures to safe messages", async () => {
    await expect(
      loadRecommendations(
        makeClient({ failWith: new TypeError("Failed to fetch") }).client,
      ),
    ).rejects.toMatchObject({ kind: "offline" });
    await expect(
      loadRecommendations(
        makeClient({ failWith: { code: "XX000", message: "internal" } }).client,
      ),
    ).rejects.toMatchObject({
      kind: "unknown",
      message: "Napaka pri nalaganju priporočil.",
    });
  });
});
