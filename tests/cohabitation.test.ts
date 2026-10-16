import { describe, expect, it, vi } from "vitest";
import {
  awaitingMyAnswer,
  chatCohabitationView,
  COHABITATION_COLUMNS,
  cohabitationCopy,
  CohabitationError,
  cohabitationMessages,
  cohabitationStatusLabel,
  cooldownUntil,
  declareCohabitation,
  endCohabitation,
  loadErrorMessage,
  loadFailureMessage,
  loadMatchCohabitations,
  loadMyCohabitations,
  monthProblemMessages,
  parseCohabitation,
  respondCohabitation,
  toCohabitationError,
  type CohabitationClient,
} from "../lib/cohabitation/cohabitation";

const ME = "11111111-1111-4111-8111-111111111111";
const PEER = "22222222-2222-4222-8222-222222222222";
const MATCH = "33333333-3333-4333-8333-333333333333";
const NOW = new Date("2026-10-16T10:00:00Z");

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "c1",
    match_id: MATCH,
    user_id_a: ME,
    user_id_b: PEER,
    initiated_by: ME,
    status: "pending",
    started_month: "2026-09-01",
    ended_month: null,
    declined_at: null,
    confirmed_at: null,
    ended_at: null,
    version: 1,
    created_at: "2026-10-10T10:00:00Z",
    ...overrides,
  };
}

const cohabitation = (overrides: Record<string, unknown> = {}) =>
  parseCohabitation(row(overrides));

type Result = { data: unknown; error: unknown };

function makeClient({
  user = { id: ME } as { id: string } | null,
  list = { data: [row()], error: null } as Result | Error,
  profiles = { data: [{ id: PEER, display_name: " Ana " }], error: null } as
    Result | Error,
  rpc = { data: row(), error: null } as Result | Error,
} = {}) {
  const calls: Array<[string, ...unknown[]]> = [];
  const settle = (result: Result | Error) =>
    result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
  const order = (...args: unknown[]) => {
    calls.push(["order", ...args]);
    return settle(list);
  };
  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user }, error: null })) },
    from: (table: string) => {
      calls.push(["from", table]);
      if (table === "profiles")
        return {
          select: (columns: string) => ({
            in: (column: string, ids: string[]) => {
              calls.push(["profiles", columns, column, ids]);
              return settle(profiles);
            },
          }),
        };
      return {
        select: (columns: string) => {
          calls.push(["select", columns]);
          return {
            eq: (column: string, value: string) => {
              calls.push(["eq", column, value]);
              return { order };
            },
            order,
          };
        },
      };
    },
    rpc: vi.fn((fn: string, args: unknown) => {
      calls.push(["rpc", fn, args]);
      return settle(rpc);
    }),
  };
  return { client: client as unknown as CohabitationClient, calls };
}

describe("parseCohabitation (response validation)", () => {
  it("maps a valid row", () => {
    expect(
      parseCohabitation(
        row({
          status: "ended",
          ended_month: "2026-10-01",
          confirmed_at: "2026-09-02T00:00:00Z",
          ended_at: "2026-10-12T00:00:00Z",
          version: 3,
        }),
      ),
    ).toEqual({
      id: "c1",
      matchId: MATCH,
      userIdA: ME,
      userIdB: PEER,
      initiatedBy: ME,
      status: "ended",
      startedMonth: "2026-09-01",
      endedMonth: "2026-10-01",
      declinedAt: null,
      confirmedAt: "2026-09-02T00:00:00Z",
      endedAt: "2026-10-12T00:00:00Z",
      version: 3,
      createdAt: "2026-10-10T10:00:00Z",
    });
  });

  it("treats missing optional timestamps as null", () => {
    const { declined_at, confirmed_at, ended_at, ended_month, ...rest } = row();
    void [declined_at, confirmed_at, ended_at, ended_month];
    expect(parseCohabitation(rest)).toMatchObject({
      endedMonth: null,
      declinedAt: null,
      confirmedAt: null,
      endedAt: null,
    });
  });

  it.each([
    ["null", null],
    ["a string", "row"],
    ["an unknown status", row({ status: "maybe" })],
    ["a non-month start", row({ started_month: "2026-09-15" })],
    ["an ended row without an end month", row({ status: "ended" })],
    [
      "an end before the start",
      row({ status: "ended", ended_month: "2026-08-01" }),
    ],
    ["an end month on an open row", row({ ended_month: "2026-10-01" })],
    ["an initiator outside the pair", row({ initiated_by: "x" })],
    ["the same person twice", row({ user_id_b: ME })],
    ["a missing id", row({ id: "" })],
    ["a version below 1", row({ version: 0 })],
    ["a fractional version", row({ version: 1.5 })],
    ["a non-string timestamp", row({ declined_at: 5 })],
    ["a missing created_at", row({ created_at: null })],
  ])("rejects %s", (_label, value) => {
    expect(() => parseCohabitation(value)).toThrow(CohabitationError);
    try {
      parseCohabitation(value);
    } catch (error) {
      expect((error as CohabitationError).kind).toBe("unknown");
    }
  });
});

describe("toCohabitationError (error mapping)", () => {
  it.each([
    [new TypeError("Failed to fetch"), "offline"],
    [{ message: "NetworkError when attempting to fetch" }, "offline"],
    [{ code: "42501", message: "not signed in" }, "signed-out"],
    [{ status: 401, message: "Unauthorized" }, "signed-out"],
    [{ code: "PGRST301", message: "JWT expired" }, "signed-out"],
    [
      { code: "42501", message: "only the other participant can respond" },
      "permission",
    ],
    [{ status: 403, message: "forbidden" }, "permission"],
    [{ message: "permission denied for table cohabitations" }, "permission"],
    [
      {
        code: "P0001",
        message:
          "cohabitation cooldown: a declaration was declined less than 30 days ago",
      },
      "cooldown",
    ],
    [
      { code: "22023", message: "cohabitation month is in the future" },
      "invalid-month",
    ],
    [
      { code: "23505", message: "an open cohabitation already exists" },
      "conflict",
    ],
    [
      { code: "P0001", message: "cohabitation is no longer pending" },
      "conflict",
    ],
    [{ code: "XX000", message: "boom" }, "unknown"],
    [null, "unknown"],
  ])("maps %j to %s", (error, kind) => {
    const mapped = toCohabitationError(error);
    expect(mapped.kind).toBe(kind);
    expect(mapped.message).toBe(
      cohabitationMessages[kind as keyof typeof cohabitationMessages],
    );
  });

  it("passes a CohabitationError through", () => {
    const error = new CohabitationError("conflict", "x");
    expect(toCohabitationError(error)).toBe(error);
  });

  it("chooses a load message", () => {
    expect(loadFailureMessage(new CohabitationError("offline"))).toBe(
      cohabitationMessages.offline,
    );
    expect(loadFailureMessage(new CohabitationError("signed-out"))).toBe(
      cohabitationMessages["signed-out"],
    );
    expect(loadFailureMessage(new CohabitationError("permission"))).toBe(
      cohabitationMessages.permission,
    );
    expect(loadFailureMessage(new CohabitationError("unknown"))).toBe(
      loadErrorMessage,
    );
    expect(loadFailureMessage(new Error("x"))).toBe(loadErrorMessage);
  });

  it("has copy for every month problem", () => {
    expect(Object.keys(monthProblemMessages).sort()).toEqual([
      "before-match",
      "before-start",
      "future",
      "not-a-month",
    ]);
  });
});

describe("loading", () => {
  it("loads one match's cohabitations, newest first, keeping only mine", async () => {
    const { client, calls } = makeClient({
      list: {
        data: [
          row(),
          row({ id: "c2", user_id_a: "x", user_id_b: "y", initiated_by: "x" }),
        ],
        error: null,
      },
    });
    const result = await loadMatchCohabitations(client, MATCH);
    expect(result.me).toBe(ME);
    expect(result.cohabitations.map((c) => c.id)).toEqual(["c1"]);
    expect(calls).toEqual([
      ["from", "cohabitations"],
      ["select", COHABITATION_COLUMNS],
      ["eq", "match_id", MATCH],
      ["order", "created_at", { ascending: false }],
    ]);
  });

  it("reports signed-out, offline, query and validation failures", async () => {
    await expect(
      loadMatchCohabitations(makeClient({ user: null }).client, MATCH),
    ).rejects.toMatchObject({ kind: "signed-out" });
    await expect(
      loadMatchCohabitations(
        makeClient({ list: new TypeError("Failed to fetch") }).client,
        MATCH,
      ),
    ).rejects.toMatchObject({ kind: "offline" });
    await expect(
      loadMatchCohabitations(
        makeClient({
          list: {
            data: null,
            error: { code: "42501", message: "permission denied" },
          },
        }).client,
        MATCH,
      ),
    ).rejects.toMatchObject({ kind: "permission" });
    await expect(
      loadMatchCohabitations(
        makeClient({ list: { data: [{ id: 1 }], error: null } }).client,
        MATCH,
      ),
    ).rejects.toMatchObject({ kind: "unknown" });
    await expect(
      loadMatchCohabitations(
        makeClient({ list: { data: null, error: null } }).client,
        MATCH,
      ),
    ).resolves.toEqual({ me: ME, cohabitations: [] });
  });

  it("loads all my cohabitations with the other person's name", async () => {
    const { client, calls } = makeClient({
      list: {
        data: [
          row(),
          row({ id: "c2", user_id_a: PEER, user_id_b: ME, initiated_by: PEER }),
          row({ id: "c3", user_id_b: "33333333-0000-4000-8000-000000000000" }),
        ],
        error: null,
      },
    });
    const { me, cohabitations } = await loadMyCohabitations(client);
    expect(me).toBe(ME);
    expect(cohabitations.map((c) => [c.id, c.peerId, c.peerName])).toEqual([
      ["c1", PEER, "Ana"],
      ["c2", PEER, "Ana"],
      ["c3", "33333333-0000-4000-8000-000000000000", "Uporabnik"],
    ]);
    expect(calls).toContainEqual([
      "profiles",
      "id,display_name",
      "id",
      [PEER, "33333333-0000-4000-8000-000000000000"],
    ]);
  });

  it("still lists cohabitations when names can't be loaded, and skips the lookup when empty", async () => {
    const failed = await loadMyCohabitations(
      makeClient({ profiles: { data: null, error: { code: "XX000" } } }).client,
    );
    expect(failed.cohabitations[0].peerName).toBe("Uporabnik");
    const nullNames = await loadMyCohabitations(
      makeClient({
        profiles: { data: [{ id: PEER, display_name: null }], error: null },
      }).client,
    );
    expect(nullNames.cohabitations[0].peerName).toBe("Uporabnik");
    const noNames = await loadMyCohabitations(
      makeClient({ profiles: { data: null, error: null } }).client,
    );
    expect(noNames.cohabitations[0].peerName).toBe("Uporabnik");

    const { client, calls } = makeClient({ list: { data: [], error: null } });
    await expect(loadMyCohabitations(client)).resolves.toEqual({
      me: ME,
      cohabitations: [],
    });
    expect(calls.some(([name]) => name === "profiles")).toBe(false);
  });

  it("maps failures of the list", async () => {
    await expect(
      loadMyCohabitations(makeClient({ user: null }).client),
    ).rejects.toMatchObject({ kind: "signed-out" });
    await expect(
      loadMyCohabitations(
        makeClient({ list: { data: null, error: { code: "XX000" } } }).client,
      ),
    ).rejects.toMatchObject({ kind: "unknown" });
  });

  it("finds matches whose declaration awaits my answer", () => {
    const list = [
      cohabitation({ id: "a", match_id: "m1", initiated_by: PEER }),
      cohabitation({ id: "b", match_id: "m2", initiated_by: ME }),
      cohabitation({
        id: "c",
        match_id: "m3",
        initiated_by: PEER,
        status: "active",
      }),
    ];
    expect([...awaitingMyAnswer(list, ME)]).toEqual(["m1"]);
  });
});

describe("RPC calls", () => {
  const rules = { matchCreatedAt: "2026-08-20T09:00:00Z", now: NOW };

  it("declares through declare_cohabitation and validates the answer", async () => {
    const { client, calls } = makeClient();
    await expect(
      declareCohabitation(client, MATCH, "2026-09-01", rules),
    ).resolves.toMatchObject({ id: "c1", status: "pending" });
    expect(calls).toEqual([
      [
        "rpc",
        "declare_cohabitation",
        { p_match_id: MATCH, p_started_month: "2026-09-01" },
      ],
    ]);
  });

  it("refuses invalid months before calling the server", async () => {
    const { client, calls } = makeClient();
    for (const month of ["2026-11-01", "2026-07-01", "2026-09-15"])
      await expect(
        declareCohabitation(client, MATCH, month, rules),
      ).rejects.toMatchObject({ kind: "invalid-month" });
    await expect(
      declareCohabitation(client, MATCH, "2999-01-01"),
    ).rejects.toMatchObject({ kind: "invalid-month" });
    expect(calls).toEqual([]);
  });

  it("reports the cooldown, a second open declaration, and a refused caller", async () => {
    const cases: Array<[unknown, string]> = [
      [
        {
          code: "P0001",
          message:
            "cohabitation cooldown: a declaration was declined less than 30 days ago",
        },
        "cooldown",
      ],
      [
        { code: "23505", message: "an open cohabitation already exists" },
        "conflict",
      ],
      [
        { code: "42501", message: "a block exists between the participants" },
        "permission",
      ],
    ];
    for (const [error, kind] of cases) {
      const { client } = makeClient({ rpc: { data: null, error } });
      await expect(
        declareCohabitation(client, MATCH, "2026-09-01", rules),
      ).rejects.toMatchObject({ kind });
    }
  });

  it("treats an empty or malformed answer as unknown", async () => {
    await expect(
      declareCohabitation(
        makeClient({ rpc: { data: null, error: null } }).client,
        MATCH,
        "2026-09-01",
        rules,
      ),
    ).rejects.toMatchObject({ kind: "unknown" });
  });

  it("responds through respond_cohabitation", async () => {
    const { client, calls } = makeClient({
      rpc: { data: row({ status: "active", version: 2 }), error: null },
    });
    await expect(
      respondCohabitation(client, "c1", true),
    ).resolves.toMatchObject({ status: "active", version: 2 });
    expect(calls).toEqual([
      ["rpc", "respond_cohabitation", { p_id: "c1", p_confirm: true }],
    ]);
    await expect(
      respondCohabitation(
        makeClient({
          rpc: {
            data: null,
            error: {
              code: "42501",
              message: "only the other participant can respond",
            },
          },
        }).client,
        "c1",
        true,
      ),
    ).rejects.toMatchObject({ kind: "permission" });
    await expect(
      respondCohabitation(
        makeClient({ rpc: new TypeError("Failed to fetch") }).client,
        "c1",
        false,
      ),
    ).rejects.toMatchObject({ kind: "offline" });
  });

  it("ends through end_cohabitation after checking the month", async () => {
    const ended = row({
      status: "ended",
      ended_month: "2026-10-01",
      version: 3,
    });
    const { client, calls } = makeClient({ rpc: { data: ended, error: null } });
    const active = cohabitation({ status: "active" });
    await expect(
      endCohabitation(client, active, "2026-10-01", NOW),
    ).resolves.toMatchObject({ status: "ended", endedMonth: "2026-10-01" });
    expect(calls).toEqual([
      ["rpc", "end_cohabitation", { p_id: "c1", p_ended_month: "2026-10-01" }],
    ]);
    await expect(
      endCohabitation(client, active, "2026-08-01", NOW),
    ).rejects.toMatchObject({ kind: "invalid-month" });
    await expect(
      endCohabitation(client, active, "2026-11-01", NOW),
    ).rejects.toMatchObject({ kind: "invalid-month" });
    expect(calls).toHaveLength(1);
  });
});

describe("cooldown", () => {
  const declined = (declinedAt: string, overrides = {}) =>
    cohabitation({ status: "declined", declined_at: declinedAt, ...overrides });

  it("lasts 30 days after my declaration was declined", () => {
    expect(cooldownUntil([declined("2026-10-01T10:00:00Z")], ME, NOW)).toEqual(
      new Date("2026-10-31T10:00:00Z"),
    );
    expect(
      cooldownUntil(
        [
          declined("2026-09-20T10:00:00Z", { id: "a" }),
          declined("2026-10-05T10:00:00Z", { id: "b" }),
        ],
        ME,
        NOW,
      ),
    ).toEqual(new Date("2026-11-04T10:00:00Z"));
  });

  it("does not apply after 30 days, to the other person, or without a decline time", () => {
    expect(
      cooldownUntil([declined("2026-09-01T10:00:00Z")], ME, NOW),
    ).toBeNull();
    expect(
      cooldownUntil([declined("2026-10-10T10:00:00Z")], PEER, NOW),
    ).toBeNull();
    expect(
      cooldownUntil([cohabitation({ status: "declined" })], ME, NOW),
    ).toBeNull();
    expect(cooldownUntil([cohabitation()], ME)).toBeNull();
  });

  it("is shown with the date it ends", () => {
    expect(cohabitationCopy.cooldown(new Date("2026-10-31T10:00:00Z"))).toBe(
      "Znova lahko predlagaš od 31. 10. 2026 dalje.",
    );
    expect(cohabitationMessages.cooldown).toContain("30 dneh");
  });
});

describe("chat view", () => {
  it("shows the declare action when nothing is open", () => {
    expect(chatCohabitationView([], ME, NOW)).toEqual({
      kind: "none",
      notConfirmed: false,
      cooldownUntil: null,
    });
    expect(
      chatCohabitationView(
        [cohabitation({ status: "ended", ended_month: "2026-10-01" })],
        ME,
      ),
    ).toMatchObject({ kind: "none", notConfirmed: false });
  });

  it("asks the other person, and tells the declarer to wait", () => {
    const pending = [cohabitation()];
    expect(chatCohabitationView(pending, PEER, NOW).kind).toBe("awaiting-me");
    expect(chatCohabitationView(pending, ME, NOW).kind).toBe("awaiting-peer");
  });

  it("shows an active cohabitation to both", () => {
    const active = [
      cohabitation({ status: "active" }),
      cohabitation({
        id: "old",
        status: "declined",
        declined_at: "2026-09-01T00:00:00Z",
        created_at: "2026-09-01T00:00:00Z",
      }),
    ];
    expect(chatCohabitationView(active, ME, NOW).kind).toBe("active");
    expect(chatCohabitationView(active, PEER, NOW).kind).toBe("active");
  });

  it("shows 'Ni potrjeno' only to the declarer, with the cooldown", () => {
    const list = [
      cohabitation({
        id: "old",
        status: "ended",
        ended_month: "2026-10-01",
        created_at: "2026-09-01T00:00:00Z",
      }),
      cohabitation({
        status: "declined",
        declined_at: "2026-10-12T10:00:00Z",
      }),
    ];
    expect(chatCohabitationView(list, ME, NOW)).toEqual({
      kind: "none",
      notConfirmed: true,
      cooldownUntil: new Date("2026-11-11T10:00:00Z"),
    });
    expect(chatCohabitationView(list, PEER, NOW)).toEqual({
      kind: "none",
      notConfirmed: false,
      cooldownUntil: null,
    });
  });

  it("formats the banner, chip and waiting copy", () => {
    expect(cohabitationCopy.banner("Ana", "2026-10-01")).toBe(
      "Ana pravi, da živita skupaj od okt. 2026.",
    );
    expect(cohabitationCopy.active("2026-10-01")).toBe(
      "Živita skupaj od okt. 2026",
    );
    expect(cohabitationCopy.awaitingPeer("Ana", "2026-10-01")).toBe(
      "Čakamo, da Ana potrdi, da živita skupaj od okt. 2026.",
    );
  });

  it("labels each state for the profile list", () => {
    expect(
      cohabitationStatusLabel(cohabitation({ status: "active" }), ME),
    ).toBe("Živita skupaj");
    expect(
      cohabitationStatusLabel(
        cohabitation({ status: "ended", ended_month: "2026-10-01" }),
        ME,
      ),
    ).toBe("Ne živita več skupaj");
    expect(
      cohabitationStatusLabel(cohabitation({ status: "declined" }), ME),
    ).toBe("Ni potrjeno");
    expect(cohabitationStatusLabel(cohabitation(), ME)).toBe(
      "Čaka na potrditev",
    );
    expect(cohabitationStatusLabel(cohabitation(), PEER)).toBe(
      "Čaka na tvoj odgovor",
    );
  });
});
