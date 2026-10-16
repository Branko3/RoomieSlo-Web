import { describe, expect, it, vi } from "vitest";
import { parseCohabitation } from "../lib/cohabitation/cohabitation";
import { monthStart } from "../lib/cohabitation/months";
import {
  answersProblem,
  loadMyRating,
  loadMySummary,
  parseMyRating,
  ratableCohabitation,
  RATING_COLUMNS,
  RatingError,
  ratingLoadFailure,
  ratingLoadMessage,
  ratingMessages,
  setRatingsVisible,
  submitRating,
  toRatingError,
  type RatingClient,
} from "../lib/ratings/ratings";
import {
  addCalendarMonths,
  ratingAction,
  ratingReminder,
  ratingWindow,
} from "../lib/ratings/rules";
import {
  belowThresholdLabel,
  improvementCountLabel,
  parseMyRatingSummary,
  parseRatingSummary,
  ratingCountLabel,
  ratingNoun,
  strengthCountLabel,
  summaryHeadline,
} from "../lib/ratings/summary";
import {
  IMPROVEMENT_TAGS,
  improvementLabels,
  inTagOrder,
  isImprovementTag,
  isStrengthTag,
  STRENGTH_TAGS,
  strengthLabels,
  tagProblem,
} from "../lib/ratings/tags";

const ME = "11111111-1111-4111-8111-111111111111";
const PEER = "22222222-2222-4222-8222-222222222222";

function cohabitation(overrides: Record<string, unknown> = {}) {
  return parseCohabitation({
    id: "c1",
    match_id: "m1",
    user_id_a: ME,
    user_id_b: PEER,
    initiated_by: ME,
    status: "active",
    started_month: "2026-02-01",
    ended_month: null,
    declined_at: null,
    confirmed_at: "2026-02-03T10:00:00Z",
    ended_at: null,
    version: 2,
    created_at: "2026-02-02T10:00:00Z",
    ...overrides,
  });
}

function ratingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "r1",
    cohabitation_id: "c1",
    rated_id: PEER,
    would_live_again: true,
    strengths: ["clean_tidy"],
    improvements: ["noise"],
    status: "hidden",
    submitted_at: "2026-10-01T10:00:00Z",
    revealed_at: null,
    updated_at: "2026-10-01T10:00:00Z",
    ...overrides,
  };
}

describe("tags", () => {
  it("has the six fixed keys of each set with Slovenian labels", () => {
    expect(STRENGTH_TAGS).toHaveLength(6);
    expect(IMPROVEMENT_TAGS).toHaveLength(6);
    expect(Object.keys(strengthLabels)).toEqual([...STRENGTH_TAGS]);
    expect(Object.keys(improvementLabels)).toEqual([...IMPROVEMENT_TAGS]);
    expect(strengthLabels.clean_tidy).toBe("Čist(a) in urejen(a)");
    expect(improvementLabels.noise).toBe("Hrup");
  });

  it("validates tags like the server", () => {
    expect(tagProblem(["clean_tidy", "pleasant"], STRENGTH_TAGS)).toBeNull();
    expect(tagProblem([], STRENGTH_TAGS)).toBeNull();
    expect(
      tagProblem(
        ["clean_tidy", "pleasant", "respects_quiet", "keeps_agreements"],
        STRENGTH_TAGS,
      ),
    ).toBe("too-many");
    expect(tagProblem(["noise"], STRENGTH_TAGS)).toBe("unknown");
    expect(tagProblem(["noise", "noise"], IMPROVEMENT_TAGS)).toBe("duplicate");
    expect(isStrengthTag("pleasant")).toBe(true);
    expect(isStrengthTag("noise")).toBe(false);
    expect(isImprovementTag("noise")).toBe(true);
    expect(isImprovementTag(3)).toBe(false);
  });

  it("sends tags in their fixed order", () => {
    expect(inTagOrder(["pleasant", "reliable_costs"], STRENGTH_TAGS)).toEqual([
      "reliable_costs",
      "pleasant",
    ]);
  });
});

describe("rating window", () => {
  it("opens 2 months after the move-in month, at midnight in Ljubljana", () => {
    const window = ratingWindow(
      cohabitation(),
      new Date("2026-03-20T00:00:00Z"),
    );
    expect(window).toEqual({
      opensAt: new Date("2026-03-31T22:00:00Z"),
      closesAt: null,
      state: "not-yet",
    });
    expect(monthStart("2026-01-01")).toEqual(new Date("2025-12-31T23:00:00Z"));
    expect(
      ratingWindow(cohabitation(), new Date("2026-04-01T10:00:00Z"))?.state,
    ).toBe("open");
  });

  it("opens at the end if that's sooner, and closes 60 days after the end", () => {
    const ended = cohabitation({
      status: "ended",
      ended_month: "2026-02-01",
      ended_at: "2026-02-20T10:00:00Z",
    });
    const window = ratingWindow(ended, new Date("2026-02-21T00:00:00Z"));
    expect(window).toMatchObject({
      opensAt: new Date("2026-02-20T10:00:00Z"),
      closesAt: new Date("2026-04-21T10:00:00Z"),
      state: "open",
    });
    expect(ratingWindow(ended, new Date("2026-04-22T00:00:00Z"))?.state).toBe(
      "closed",
    );
  });

  it("does not exist for unconfirmed cohabitations", () => {
    expect(
      ratingWindow(cohabitation({ status: "pending", confirmed_at: null })),
    ).toBeNull();
    expect(ratingWindow(cohabitation({ confirmed_at: null }))).toBeNull();
    expect(ratingWindow(cohabitation({ status: "declined" }))).toBeNull();
  });

  it("adds calendar months like Postgres, clamping to the month's last day", () => {
    expect(addCalendarMonths(new Date("2026-08-31T10:00:00Z"), 6)).toEqual(
      new Date("2027-02-28T10:00:00Z"),
    );
    expect(addCalendarMonths(new Date("2026-04-15T10:00:00Z"), 6)).toEqual(
      new Date("2026-10-15T10:00:00Z"),
    );
  });
});

describe("rating actions", () => {
  const now = new Date("2026-10-16T10:00:00Z");
  const hidden = {
    status: "hidden" as const,
    submittedAt: "2026-10-01T10:00:00Z",
  };
  const revealed = {
    status: "revealed" as const,
    submittedAt: "2026-10-01T10:00:00Z",
  };

  it("rates once the window is open", () => {
    expect(ratingAction(cohabitation(), null, now).kind).toBe("rate");
    expect(
      ratingAction(cohabitation(), null, new Date("2026-03-01")).kind,
    ).toBe("unavailable");
    expect(
      ratingAction(
        cohabitation({ status: "pending", confirmed_at: null }),
        null,
        now,
      ).kind,
    ).toBe("unavailable");
  });

  it("edits while hidden, locks after reveal, and updates after 6 months while active", () => {
    expect(ratingAction(cohabitation(), hidden, now).kind).toBe("edit");
    expect(ratingAction(cohabitation(), revealed, now)).toMatchObject({
      kind: "locked",
      until: new Date("2027-04-01T10:00:00Z"),
    });
    expect(
      ratingAction(cohabitation(), revealed, new Date("2027-04-02T00:00:00Z"))
        .kind,
    ).toBe("update");
  });

  it("never updates after the end, and nothing after the window closed", () => {
    const ended = cohabitation({
      status: "ended",
      ended_month: "2026-10-01",
      ended_at: "2026-10-10T10:00:00Z",
    });
    expect(ratingAction(ended, revealed, now)).toMatchObject({
      kind: "locked",
      until: null,
    });
    const late = new Date("2026-12-31T00:00:00Z");
    expect(ratingAction(ended, null, late).kind).toBe("unavailable");
    expect(ratingAction(ended, hidden, late)).toMatchObject({
      kind: "locked",
      until: null,
    });
  });

  it("reminds when the window opens and 7 days before it closes", () => {
    expect(ratingReminder(ratingAction(cohabitation(), null, now), now)).toBe(
      "open",
    );
    const ended = cohabitation({
      status: "ended",
      ended_month: "2026-08-01",
      ended_at: "2026-08-20T10:00:00Z",
    });
    const closing = new Date("2026-10-14T10:00:00Z");
    expect(ratingReminder(ratingAction(ended, null, closing), closing)).toBe(
      "closing",
    );
    const early = new Date("2026-09-01T10:00:00Z");
    expect(ratingReminder(ratingAction(ended, null, early), early)).toBe(
      "open",
    );
    expect(
      ratingReminder(ratingAction(cohabitation(), hidden, now), now),
    ).toBeNull();
    expect(ratingReminder(ratingAction(cohabitation(), null))).toBe("open");
  });

  it("picks the latest confirmed cohabitation of a chat", () => {
    expect(ratableCohabitation([])).toBeNull();
    expect(
      ratableCohabitation([
        cohabitation({
          id: "old",
          status: "ended",
          ended_month: "2026-03-01",
          ended_at: "2026-03-05T00:00:00Z",
          created_at: "2026-02-01T00:00:00Z",
        }),
        cohabitation({ id: "new", created_at: "2026-05-01T00:00:00Z" }),
        cohabitation({
          id: "pending",
          status: "pending",
          confirmed_at: null,
          created_at: "2026-09-01T00:00:00Z",
        }),
      ])?.id,
    ).toBe("new");
  });
});

describe("summaries", () => {
  const shown = {
    state: "shown",
    total: 4,
    would_live_again: 3,
    strengths: [
      { tag: "clean_tidy", count: 3 },
      { tag: "pleasant", count: 2 },
    ],
  };

  it("parses the public summary", () => {
    expect(parseRatingSummary(shown)).toEqual({
      state: "shown",
      total: 4,
      wouldLiveAgain: 3,
      strengths: [
        { tag: "clean_tidy", count: 3 },
        { tag: "pleasant", count: 2 },
      ],
    });
    expect(parseRatingSummary({ state: "hidden" })).toEqual({
      state: "hidden",
    });
    expect(parseRatingSummary({ state: "insufficient" })).toEqual({
      state: "insufficient",
    });
  });

  it.each([
    ["null", null],
    ["an unknown state", { state: "maybe" }],
    ["fewer than 3", { ...shown, total: 2, would_live_again: 1 }],
    ["more yes than total", { ...shown, would_live_again: 5 }],
    [
      "a tag count above total",
      { ...shown, strengths: [{ tag: "clean_tidy", count: 5 }] },
    ],
    [
      "a zero count",
      { ...shown, strengths: [{ tag: "clean_tidy", count: 0 }] },
    ],
    [
      "an improvement tag",
      { ...shown, strengths: [{ tag: "noise", count: 1 }] },
    ],
    [
      "a repeated tag",
      {
        ...shown,
        strengths: [
          { tag: "pleasant", count: 1 },
          { tag: "pleasant", count: 1 },
        ],
      },
    ],
    [
      "4 strengths",
      {
        ...shown,
        total: 9,
        strengths: STRENGTH_TAGS.slice(0, 4).map((tag) => ({ tag, count: 1 })),
      },
    ],
    ["no strengths list", { ...shown, strengths: undefined }],
    ["a null strength", { ...shown, strengths: [null] }],
  ])("rejects a public summary with %s", (_label, value) => {
    expect(parseRatingSummary(value)).toBeNull();
  });

  it("parses my own summary, with improvements and visibility", () => {
    expect(
      parseMyRatingSummary({
        ...shown,
        improvements: [{ tag: "noise", count: 2 }],
        visible: false,
      }),
    ).toMatchObject({
      state: "shown",
      improvements: [{ tag: "noise", count: 2 }],
      visible: false,
    });
    expect(
      parseMyRatingSummary({ state: "insufficient", count: 2, visible: true }),
    ).toEqual({ state: "insufficient", count: 2, visible: true });
    for (const bad of [
      null,
      { state: "insufficient", count: 2 },
      { state: "insufficient", count: 3, visible: true },
      { state: "hidden", visible: true },
      {
        ...shown,
        visible: true,
        improvements: [{ tag: "pleasant", count: 1 }],
      },
      { ...shown, visible: true, total: 1 },
    ])
      expect(parseMyRatingSummary(bad)).toBeNull();
  });

  it("uses Slovenian plural forms", () => {
    expect(
      [1, 2, 3, 4, 5, 11, 21, 101, 102, 103, 0].map(ratingCountLabel),
    ).toEqual([
      "1 ocena",
      "2 oceni",
      "3 ocene",
      "4 ocene",
      "5 ocen",
      "11 ocen",
      "21 ocen",
      "101 ocena",
      "102 oceni",
      "103 ocene",
      "0 ocen",
    ]);
    expect(ratingNoun(-2)).toBe("oceni");
  });

  it("formats what people see", () => {
    expect(summaryHeadline(parseRatingSummary(shown)!)).toBe(
      "3 od 4 sostanovalcev bi spet živeli s to osebo",
    );
    expect(summaryHeadline({ state: "insufficient" })).toBe(
      "Še ni dovolj ocen",
    );
    expect(summaryHeadline({ state: "hidden" })).toBe("Ocene so skrite");
    expect(belowThresholdLabel(2)).toBe("2 oceni, prikazane bodo od 3 dalje");
    expect(belowThresholdLabel(1)).toBe("1 ocena, prikazane bodo od 3 dalje");
    expect(belowThresholdLabel(0)).toBe("Še nimaš ocen.");
    expect(strengthCountLabel({ tag: "clean_tidy", count: 3 })).toBe(
      "Čist(a) in urejen(a) · 3",
    );
    expect(improvementCountLabel({ tag: "noise", count: 2 })).toBe("Hrup · 2");
  });
});

type Outcome = { data: unknown; error: unknown } | Error;

function makeClient({
  user = { id: ME } as { id: string } | null,
  rating = { data: ratingRow(), error: null } as Outcome,
  rpc = { data: ratingRow(), error: null } as Outcome,
  update = { data: { show_roommate_ratings: false }, error: null } as Outcome,
} = {}) {
  const calls: unknown[][] = [];
  const settle = (o: Outcome) =>
    o instanceof Error ? Promise.reject(o) : Promise.resolve(o);
  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user }, error: null })) },
    from: (table: string) => ({
      select: (columns: string) => ({
        eq: (column: string, value: string) => ({
          maybeSingle: () => {
            calls.push([table, columns, column, value]);
            return settle(rating);
          },
        }),
      }),
      update: (values: unknown) => ({
        eq: (column: string, value: string) => ({
          select: (columns: string) => ({
            maybeSingle: () => {
              calls.push([table, "update", values, column, value, columns]);
              return settle(update);
            },
          }),
        }),
      }),
    }),
    rpc: vi.fn((fn: string, args?: unknown) => {
      calls.push(["rpc", fn, args]);
      return settle(rpc);
    }),
  };
  return { client: client as unknown as RatingClient, calls };
}

describe("rating client", () => {
  const now = new Date("2026-10-16T10:00:00Z");
  const answers = {
    wouldLiveAgain: true,
    strengths: ["pleasant" as const, "clean_tidy" as const],
    improvements: ["visitors" as const],
  };

  it("loads my rating of a cohabitation", async () => {
    const { client, calls } = makeClient();
    await expect(loadMyRating(client, "c1")).resolves.toMatchObject({
      id: "r1",
      wouldLiveAgain: true,
      strengths: ["clean_tidy"],
      status: "hidden",
    });
    expect(calls).toEqual([
      ["roommate_ratings", RATING_COLUMNS, "cohabitation_id", "c1"],
    ]);
    await expect(
      loadMyRating(
        makeClient({ rating: { data: null, error: null } }).client,
        "c1",
      ),
    ).resolves.toBeNull();
    await expect(
      loadMyRating(makeClient({ user: null }).client, "c1"),
    ).rejects.toMatchObject({ kind: "signed-out" });
    await expect(
      loadMyRating(
        makeClient({ rating: { data: null, error: { code: "XX000" } } }).client,
        "c1",
      ),
    ).rejects.toMatchObject({ kind: "unknown" });
  });

  it("validates my rating rows", () => {
    expect(
      parseMyRating(ratingRow({ revealed_at: undefined })).revealedAt,
    ).toBeNull();
    for (const bad of [
      null,
      ratingRow({ strengths: ["noise"] }),
      ratingRow({ improvements: "noise" }),
      ratingRow({ would_live_again: "yes" }),
      ratingRow({ status: "public" }),
      ratingRow({ revealed_at: 3 }),
      ratingRow({ id: "" }),
    ])
      expect(() => parseMyRating(bad)).toThrow(RatingError);
  });

  it("submits through the RPC with tags in their fixed order", async () => {
    const { client, calls } = makeClient();
    await submitRating(client, cohabitation(), answers, null, now);
    expect(calls).toEqual([
      [
        "rpc",
        "submit_roommate_rating",
        {
          p_cohabitation_id: "c1",
          p_would_live_again: true,
          p_strengths: ["clean_tidy", "pleasant"],
          p_improvements: ["visitors"],
        },
      ],
    ]);
  });

  it("checks the answers and the window before calling the server", async () => {
    const { client, calls } = makeClient();
    expect(answersProblem({ ...answers, wouldLiveAgain: null })).toBe(true);
    await expect(
      submitRating(
        client,
        cohabitation(),
        { ...answers, wouldLiveAgain: null },
        null,
        now,
      ),
    ).rejects.toMatchObject({ kind: "invalid" });
    await expect(
      submitRating(
        client,
        cohabitation(),
        {
          ...answers,
          improvements: ["noise", "costs", "visitors", "agreements"],
        },
        null,
        now,
      ),
    ).rejects.toMatchObject({ kind: "invalid" });
    await expect(
      submitRating(
        client,
        cohabitation(),
        answers,
        null,
        new Date("2026-03-01"),
      ),
    ).rejects.toMatchObject({ kind: "window" });
    await expect(
      submitRating(
        client,
        cohabitation(),
        answers,
        parseMyRating(
          ratingRow({
            status: "revealed",
            revealed_at: "2026-10-02T00:00:00Z",
          }),
        ),
        now,
      ),
    ).rejects.toMatchObject({ kind: "locked" });
    expect(calls).toEqual([]);
  });

  it("maps server refusals", async () => {
    const cases: Array<[unknown, string]> = [
      [
        { code: "42501", message: "cohabitation is not confirmed" },
        "permission",
      ],
      [{ code: "22023", message: "invalid rating tags: strengths" }, "invalid"],
      [{ code: "P0001", message: "rating window has closed" }, "window"],
      [{ code: "P0001", message: "rating cannot be updated yet" }, "locked"],
      [{ code: "42501", message: "not signed in" }, "signed-out"],
    ];
    for (const [error, kind] of cases)
      await expect(
        submitRating(
          makeClient({ rpc: { data: null, error } }).client,
          cohabitation(),
          answers,
          null,
          now,
        ),
      ).rejects.toMatchObject({ kind });
  });

  it.each([
    [new TypeError("Failed to fetch"), "offline"],
    [{ status: 401 }, "signed-out"],
    [{ code: "PGRST301" }, "signed-out"],
    [{ status: 403 }, "permission"],
    [{ message: "permission denied for table roommate_ratings" }, "permission"],
    [{ code: "XX000" }, "unknown"],
    [null, "unknown"],
  ])("maps %j to %s", (error, kind) => {
    expect(toRatingError(error).kind).toBe(kind);
  });

  it("keeps a RatingError and picks load messages", () => {
    const error = new RatingError("locked");
    expect(toRatingError(error)).toBe(error);
    expect(error.message).toBe(ratingMessages.locked);
    expect(ratingLoadFailure(new RatingError("offline"))).toBe(
      ratingMessages.offline,
    );
    expect(ratingLoadFailure(new RatingError("signed-out"))).toBe(
      ratingMessages["signed-out"],
    );
    expect(ratingLoadFailure(new RatingError("permission"))).toBe(
      ratingMessages.permission,
    );
    expect(ratingLoadFailure(new RatingError("unknown"))).toBe(
      ratingLoadMessage,
    );
    expect(ratingLoadFailure("x")).toBe(ratingLoadMessage);
  });

  it("loads my summary and rejects malformed ones", async () => {
    const summary = { state: "insufficient", count: 1, visible: true };
    await expect(
      loadMySummary(makeClient({ rpc: { data: summary, error: null } }).client),
    ).resolves.toEqual(summary);
    await expect(
      loadMySummary(
        makeClient({ rpc: { data: { state: "x" }, error: null } }).client,
      ),
    ).rejects.toMatchObject({ kind: "unknown" });
    await expect(
      loadMySummary(
        makeClient({ rpc: { data: null, error: { code: "XX000" } } }).client,
      ),
    ).rejects.toMatchObject({ kind: "unknown" });
    await expect(
      loadMySummary(makeClient({ user: null }).client),
    ).rejects.toMatchObject({
      kind: "signed-out",
    });
  });

  it("saves the visibility setting on my own profile", async () => {
    const { client, calls } = makeClient();
    await expect(setRatingsVisible(client, false)).resolves.toBe(false);
    expect(calls).toEqual([
      [
        "profiles",
        "update",
        { show_roommate_ratings: false },
        "id",
        ME,
        "show_roommate_ratings",
      ],
    ]);
    await expect(
      setRatingsVisible(
        makeClient({ update: { data: null, error: null } }).client,
        true,
      ),
    ).rejects.toMatchObject({ kind: "permission" });
    await expect(
      setRatingsVisible(
        makeClient({ update: new TypeError("Failed to fetch") }).client,
        true,
      ),
    ).rejects.toMatchObject({ kind: "offline" });
  });
});
