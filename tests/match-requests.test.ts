import { describe, expect, it, vi } from "vitest";
import {
  loadMyMatches,
  MATCH_COLUMNS,
  matchMessages,
  MatchRequestError,
  matchStatusLabel,
  respondToMatch,
  toMatchRows,
  type MatchClient,
  type MatchRecord,
} from "../lib/matching/match-requests";

const ME = "me";

function match(
  id: string,
  a: string,
  b: string,
  status: MatchRecord["status"] = "pending",
): MatchRecord {
  return {
    id,
    user_id_a: a,
    user_id_b: b,
    status,
    version: 1,
    created_at: `2026-10-0${id.length}T00:00:00Z`,
  };
}

type Result<T> = { data: T | null; error: unknown } | Error;
const settle = <T>(result: Result<T>) =>
  result instanceof Error ? Promise.reject(result) : Promise.resolve(result);

function makeClient({
  user = { id: ME } as { id: string } | null,
  matches = { data: [], error: null } as Result<MatchRecord[]>,
  profiles = { data: [], error: null } as Result<
    Array<{ id: string; display_name: string | null }>
  >,
  update = { data: [{ id: "m1", status: "accepted" }], error: null } as Result<
    Array<{ id: string; status: string }>
  >,
} = {}) {
  const calls: Array<[string, unknown[]]> = [];
  const log = (name: string, ...args: unknown[]) => calls.push([name, args]);
  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user }, error: null })) },
    from: (table: string) => {
      log("from", table);
      if (table === "profiles") {
        return {
          select: (columns: string) => {
            log("select", columns);
            return {
              in: (column: string, values: string[]) => {
                log("in", column, values);
                return settle(profiles);
              },
            };
          },
        };
      }
      return {
        select: (columns: string) => {
          log("select", columns);
          return {
            or: (filters: string) => {
              log("or", filters);
              return {
                order: (column: string, options: unknown) => {
                  log("order", column, options);
                  return settle(matches);
                },
              };
            },
          };
        },
        update: (values: unknown) => {
          log("update", values);
          const chain = {
            eq: (column: string, value: unknown) => {
              log("eq", column, value);
              return chain;
            },
            select: (columns: string) => {
              log("select", columns);
              return settle(update);
            },
          };
          return chain;
        },
      };
    },
  };
  return { client: client as unknown as MatchClient, calls };
}

describe("matchStatusLabel (Android ChatScreens copy)", () => {
  it.each([
    ["accepted", false, "Sprejeto — odpri klepet"],
    ["pending", true, "Nova zahteva za ujemanje"],
    ["pending", false, "Čaka na odgovor"],
    ["rejected", false, "Zavrnjeno"],
  ] as const)("%s (recipient: %s) → %s", (status, iAmRecipient, label) => {
    expect(
      matchStatusLabel({ match: match("m", ME, "x", status), iAmRecipient }),
    ).toBe(label);
  });
});

describe("toMatchRows", () => {
  const names = new Map([
    ["ana", "Ana K."],
    ["bor", "Bor"],
  ]);

  it("resolves the other person and whether I must answer", () => {
    const rows = toMatchRows(
      [
        match("m1", "ana", ME),
        match("m2", ME, "bor"),
        match("m3", "ana", ME, "accepted"),
      ],
      ME,
      names,
    );
    expect(
      rows.map((r) => [r.match.id, r.peerId, r.peerName, r.iAmRecipient]),
    ).toEqual([
      ["m1", "ana", "Ana K.", true],
      ["m2", "bor", "Bor", false],
      ["m3", "ana", "Ana K.", false],
    ]);
  });

  it("falls back to a neutral name", () => {
    expect(toMatchRows([match("m1", "ghost", ME)], ME, names)[0].peerName).toBe(
      "Uporabnik",
    );
  });
});

describe("loadMyMatches", () => {
  it("loads the user's matches newest first with peer names", async () => {
    const { client, calls } = makeClient({
      matches: {
        data: [
          match("m1", "ana", ME),
          match("m2", ME, "bor"),
          match("m3", "ana", ME, "rejected"),
        ],
        error: null,
      },
      profiles: {
        data: [
          { id: "ana", display_name: "Ana K." },
          { id: "bor", display_name: null },
        ],
        error: null,
      },
    });
    const rows = await loadMyMatches(client);
    expect(rows.map((r) => [r.peerName, matchStatusLabel(r)])).toEqual([
      ["Ana K.", "Nova zahteva za ujemanje"],
      ["Uporabnik", "Čaka na odgovor"],
      ["Ana K.", "Zavrnjeno"],
    ]);
    expect(calls).toContainEqual(["select", [MATCH_COLUMNS]]);
    expect(calls).toContainEqual([
      "or",
      [`user_id_a.eq.${ME},user_id_b.eq.${ME}`],
    ]);
    expect(calls).toContainEqual([
      "order",
      ["created_at", { ascending: false }],
    ]);
    expect(calls).toContainEqual(["in", ["id", ["ana", "bor"]]]);
  });

  it("skips the profile lookup when there are no matches", async () => {
    const { client, calls } = makeClient();
    await expect(loadMyMatches(client)).resolves.toEqual([]);
    expect(
      calls.some(([name, args]) => name === "from" && args[0] === "profiles"),
    ).toBe(false);
  });

  it("requires a signed-in user", async () => {
    const { client, calls } = makeClient({ user: null });
    await expect(loadMyMatches(client)).rejects.toMatchObject({
      kind: "signed-out",
    });
    expect(calls).toEqual([]);
  });

  it("maps failures to safe messages", async () => {
    await expect(
      loadMyMatches(
        makeClient({ matches: new TypeError("Failed to fetch") }).client,
      ),
    ).rejects.toMatchObject({
      kind: "offline",
      message: matchMessages.offline,
    });
    await expect(
      loadMyMatches(
        makeClient({
          matches: {
            data: null,
            error: { code: "XX000", message: "internal" },
          },
        }).client,
      ),
    ).rejects.toMatchObject({ kind: "failed", message: matchMessages.load });
  });
});

describe("respondToMatch", () => {
  it("accepts only a pending request addressed to the current user", async () => {
    const { client, calls } = makeClient();
    await respondToMatch(client, "m1", "accepted");
    expect(calls.slice(1)).toEqual([
      ["update", [{ status: "accepted" }]],
      ["eq", ["id", "m1"]],
      ["eq", ["status", "pending"]],
      ["eq", ["user_id_b", ME]],
      ["select", ["id,status"]],
    ]);
  });

  it("rejects with the same guards", async () => {
    const { client, calls } = makeClient({
      update: { data: [{ id: "m1", status: "rejected" }], error: null },
    });
    await respondToMatch(client, "m1", "rejected");
    expect(calls[1]).toEqual(["update", [{ status: "rejected" }]]);
  });

  it("reports a conflict when the request was already handled (Android Conflict)", async () => {
    const { client } = makeClient({ update: { data: [], error: null } });
    const error = await respondToMatch(client, "m1", "accepted").catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(MatchRequestError);
    expect(error).toMatchObject({
      kind: "conflict",
      message: "Ta zahteva je bila že obravnavana.",
    });
  });

  it("uses Android's failure copy per decision", async () => {
    const failing = {
      data: null,
      error: { code: "XX000", message: "internal" },
    };
    await expect(
      respondToMatch(makeClient({ update: failing }).client, "m1", "accepted"),
    ).rejects.toMatchObject({
      message: "Zahteve ni bilo mogoče sprejeti.",
    });
    await expect(
      respondToMatch(makeClient({ update: failing }).client, "m1", "rejected"),
    ).rejects.toMatchObject({
      message: "Zahteve ni bilo mogoče zavrniti.",
    });
  });

  it("maps network failures and requires a session", async () => {
    await expect(
      respondToMatch(
        makeClient({ update: new TypeError("Failed to fetch") }).client,
        "m1",
        "accepted",
      ),
    ).rejects.toMatchObject({ kind: "offline" });
    await expect(
      respondToMatch(makeClient({ user: null }).client, "m1", "accepted"),
    ).rejects.toMatchObject({
      kind: "signed-out",
    });
  });
});
