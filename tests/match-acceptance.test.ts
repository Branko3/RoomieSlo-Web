import { describe, expect, it, vi } from "vitest";
import {
  acceptMatchAtomically,
  applyDecision,
  conflictMessage,
  isAcceptConflict,
  readMatchStatus,
  rejectMatchWithConflictCheck,
  type MatchAcceptanceClient,
} from "../lib/matching/match-acceptance";
import {
  matchMessages,
  MatchRequestError,
  type MatchRecord,
} from "../lib/matching/match-requests";

const ME = "me";

function record(status: MatchRecord["status"], version = 1): MatchRecord {
  return {
    id: "m1",
    user_id_a: "ana",
    user_id_b: ME,
    status,
    version,
    created_at: "2026-10-01T00:00:00Z",
  };
}

/**
 * In-memory "database" with one match row that mimics the server: the
 * `accept_match` RPC and the conditional reject both apply only while the row
 * is pending, exactly like the SQL, so concurrent calls can be simulated.
 */
function fakeDatabase(
  initial: MatchRecord | null,
  options: { rpcError?: unknown; readError?: unknown } = {},
) {
  let row = initial ? { ...initial } : null;
  const rpc = vi.fn(async (fn: string, args: { p_match_id: string }) => {
    if (options.rpcError instanceof Error) throw options.rpcError;
    if (options.rpcError) return { data: null, error: options.rpcError };
    if (!row || row.id !== args.p_match_id || row.status !== "pending") {
      return {
        data: null,
        error: {
          code: "P0001",
          message: "match is unavailable or caller is not a participant",
        },
      };
    }
    row = { ...row, status: "accepted", version: row.version + 1 };
    return { data: { ...row }, error: null };
  });
  const client = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: ME } }, error: null })),
    },
    rpc,
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            if (options.readError) throw options.readError;
            return { data: row ? { ...row } : null, error: null };
          },
        }),
      }),
      update: (values: { status: MatchRecord["status"] }) => {
        const filters: Record<string, unknown> = {};
        const chain = {
          eq: (column: string, value: unknown) => {
            filters[column] = value;
            return chain;
          },
          select: async () => {
            const matches =
              row &&
              row.id === filters.id &&
              row.status === filters.status &&
              row.user_id_b === filters.user_id_b;
            if (!matches || !row) return { data: [], error: null };
            row = { ...row, status: values.status };
            return { data: [{ id: row.id, status: row.status }], error: null };
          },
        };
        return chain;
      },
    }),
  };
  return {
    client: client as unknown as MatchAcceptanceClient,
    rpc,
    current: () => row,
    set: (next: MatchRecord | null) => {
      row = next;
    },
  };
}

describe("conflictMessage", () => {
  it.each([
    ["accepted", "Zahteva je že sprejeta."],
    ["rejected", "Zahteva je bila medtem zavrnjena."],
    [null, "Zahteva ne obstaja več."],
    ["pending", "Te zahteve ne moreš sprejeti."],
  ] as const)("explains %s", (status, message) => {
    expect(conflictMessage(status)).toBe(message);
  });
});

describe("isAcceptConflict", () => {
  it("recognizes the RPC's 'unavailable' exception", () => {
    expect(isAcceptConflict({ code: "P0001", message: "x" })).toBe(true);
    expect(
      isAcceptConflict({
        message: "match is unavailable or caller is not a participant",
      }),
    ).toBe(true);
    expect(isAcceptConflict({ code: "XX000", message: "internal" })).toBe(
      false,
    );
    expect(isAcceptConflict(null)).toBe(false);
  });
});

describe("acceptMatchAtomically", () => {
  it("accepts through the accept_match RPC and returns the updated row", async () => {
    const db = fakeDatabase(record("pending"));
    await expect(acceptMatchAtomically(db.client, "m1")).resolves.toMatchObject(
      {
        status: "accepted",
        version: 2,
      },
    );
    expect(db.rpc).toHaveBeenCalledWith("accept_match", { p_match_id: "m1" });
  });

  it("lets only one of two concurrent accepts succeed", async () => {
    const db = fakeDatabase(record("pending"));
    const results = await Promise.allSettled([
      acceptMatchAtomically(db.client, "m1"),
      acceptMatchAtomically(db.client, "m1"),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const failed = results.find(
      (r) => r.status === "rejected",
    ) as PromiseRejectedResult;
    expect(failed.reason).toMatchObject({
      kind: "conflict",
      message: "Zahteva je že sprejeta.",
    });
    expect(db.current()).toMatchObject({ status: "accepted", version: 2 });
  });

  it("explains an accept that lost to a reject", async () => {
    const db = fakeDatabase(record("pending"));
    await rejectMatchWithConflictCheck(db.client, "m1");
    await expect(acceptMatchAtomically(db.client, "m1")).rejects.toMatchObject({
      kind: "conflict",
      message: "Zahteva je bila medtem zavrnjena.",
    });
  });

  it("explains a request that no longer exists", async () => {
    const db = fakeDatabase(null);
    await expect(acceptMatchAtomically(db.client, "m1")).rejects.toMatchObject({
      message: "Zahteva ne obstaja več.",
    });
  });

  it("falls back to the Android conflict copy when the follow-up read fails", async () => {
    const db = fakeDatabase(record("accepted"), {
      readError: new TypeError("Failed to fetch"),
    });
    await expect(acceptMatchAtomically(db.client, "m1")).rejects.toMatchObject({
      kind: "conflict",
      message: matchMessages.alreadyHandled,
    });
  });

  it("maps technical failures to safe messages", async () => {
    await expect(
      acceptMatchAtomically(
        fakeDatabase(record("pending"), {
          rpcError: new TypeError("Failed to fetch"),
        }).client,
        "m1",
      ),
    ).rejects.toMatchObject({ kind: "offline" });
    await expect(
      acceptMatchAtomically(
        fakeDatabase(record("pending"), {
          rpcError: { code: "XX000", message: "internal" },
        }).client,
        "m1",
      ),
    ).rejects.toMatchObject({
      kind: "failed",
      message: "Zahteve ni bilo mogoče sprejeti.",
    });
  });
});

describe("rejectMatchWithConflictCheck", () => {
  it("rejects a pending request", async () => {
    const db = fakeDatabase(record("pending"));
    await rejectMatchWithConflictCheck(db.client, "m1");
    expect(db.current()?.status).toBe("rejected");
  });

  it("explains a reject that lost to an accept", async () => {
    const db = fakeDatabase(record("pending"));
    await acceptMatchAtomically(db.client, "m1");
    const error = await rejectMatchWithConflictCheck(db.client, "m1").catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(MatchRequestError);
    expect(error).toMatchObject({
      kind: "conflict",
      message: "Zahteva je že sprejeta.",
    });
    expect(db.current()?.status).toBe("accepted");
  });

  it("resolves exactly one winner when accept and reject race", async () => {
    const db = fakeDatabase(record("pending"));
    const results = await Promise.allSettled([
      acceptMatchAtomically(db.client, "m1"),
      rejectMatchWithConflictCheck(db.client, "m1"),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(["accepted", "rejected"]).toContain(db.current()?.status);
  });
});

describe("readMatchStatus", () => {
  it("returns the current status or null", async () => {
    expect(
      await readMatchStatus(fakeDatabase(record("rejected")).client, "m1"),
    ).toBe("rejected");
    expect(await readMatchStatus(fakeDatabase(null).client, "m1")).toBeNull();
  });
});

describe("applyDecision", () => {
  it("updates only the decided row and clears the recipient action", () => {
    const rows = [
      { match: record("pending"), iAmRecipient: true, peerName: "Ana" },
      {
        match: { ...record("pending"), id: "m2" },
        iAmRecipient: true,
        peerName: "Bor",
      },
    ];
    const next = applyDecision(rows, "m1", "accepted", 2);
    expect(next[0]).toMatchObject({
      iAmRecipient: false,
      match: { status: "accepted", version: 2 },
    });
    expect(next[1]).toBe(rows[1]);
    expect(applyDecision(rows, "m1", "rejected")[0].match.version).toBe(1);
  });
});
