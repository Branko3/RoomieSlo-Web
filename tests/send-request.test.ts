import { describe, expect, it, vi } from "vitest";
import {
  existingRequestMessage,
  loadRequestState,
  pairFilter,
  sendMatchRequest,
  sendRequestMessages,
  SendRequestError,
  type SendRequestClient,
} from "../lib/matching/send-request";

const ME = "me";
const OWNER = "owner";

type Row = {
  id: string;
  user_id_a: string;
  user_id_b: string;
  status: "pending" | "accepted" | "rejected";
};

/**
 * In-memory `matches` table that enforces the same constraints as the database:
 * a unique pair index on (least, greatest) and user_id_a <> user_id_b.
 * `hideNextLookup` simulates another tab inserting between our lookup and insert.
 */
function fakeTable(
  rows: Row[] = [],
  options: {
    hideNextLookup?: boolean;
    insertError?: unknown;
    lookupError?: unknown;
  } = {},
) {
  let hide = options.hideNextLookup ?? false;
  const inserts: Array<{ user_id_a: string; user_id_b: string }> = [];
  const parsePair = (filters: string) => {
    const match = filters.match(
      /^and\(user_id_a\.eq\.([^,]+),user_id_b\.eq\.([^)]+)\)/,
    );
    if (!match) throw new Error(`Unexpected filter ${filters}`);
    return [match[1], match[2]] as const;
  };
  const client = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: ME } }, error: null })),
    },
    from: () => ({
      select: () => ({
        or: (filters: string) => ({
          limit: async () => {
            if (options.lookupError) throw options.lookupError;
            if (hide) {
              hide = false;
              return { data: [], error: null };
            }
            const [a, b] = parsePair(filters);
            const found = rows.filter(
              (r) =>
                (r.user_id_a === a && r.user_id_b === b) ||
                (r.user_id_a === b && r.user_id_b === a),
            );
            return { data: found.slice(0, 1), error: null };
          },
        }),
      }),
      insert: (row: { user_id_a: string; user_id_b: string }) => ({
        select: () => ({
          single: async () => {
            inserts.push(row);
            if (options.insertError)
              return { data: null, error: options.insertError };
            if (row.user_id_a === row.user_id_b) {
              return {
                data: null,
                error: { code: "23514", message: "matches_distinct_users" },
              };
            }
            const duplicate = rows.some(
              (r) =>
                (r.user_id_a === row.user_id_a &&
                  r.user_id_b === row.user_id_b) ||
                (r.user_id_a === row.user_id_b &&
                  r.user_id_b === row.user_id_a),
            );
            if (duplicate) {
              return {
                data: null,
                error: { code: "23505", message: "matches_user_pair_idx" },
              };
            }
            const created: Row = {
              id: `m${rows.length + 1}`,
              ...row,
              status: "pending",
            };
            rows.push(created);
            return { data: created, error: null };
          },
        }),
      }),
    }),
  };
  return { client: client as unknown as SendRequestClient, rows, inserts };
}

function signedOut(table: ReturnType<typeof fakeTable>) {
  (table.client.auth.getUser as ReturnType<typeof vi.fn>).mockResolvedValue({
    data: { user: null },
    error: null,
  });
  return table;
}

describe("pairFilter", () => {
  it("matches the pair in either direction", () => {
    expect(pairFilter("a", "b")).toBe(
      "and(user_id_a.eq.a,user_id_b.eq.b),and(user_id_a.eq.b,user_id_b.eq.a)",
    );
  });
});

describe("sendMatchRequest", () => {
  it("creates a request from me to the owner (Android sendRequest)", async () => {
    const table = fakeTable();
    await expect(sendMatchRequest(table.client, OWNER)).resolves.toEqual({
      created: true,
      request: { id: "m1", status: "pending", sentByMe: true },
    });
    expect(table.inserts).toEqual([{ user_id_a: ME, user_id_b: OWNER }]);
  });

  it("never inserts a second request when one already exists in either direction", async () => {
    for (const existing of [
      { id: "m1", user_id_a: ME, user_id_b: OWNER, status: "pending" as const },
      { id: "m1", user_id_a: OWNER, user_id_b: ME, status: "pending" as const },
    ]) {
      const table = fakeTable([existing]);
      const result = await sendMatchRequest(table.client, OWNER);
      expect(result.created).toBe(false);
      expect(result.request.sentByMe).toBe(existing.user_id_a === ME);
      expect(table.inserts).toEqual([]);
      expect(table.rows).toHaveLength(1);
    }
  });

  it("returns the winner when another tab inserted between lookup and insert (23505)", async () => {
    const table = fakeTable(
      [{ id: "m1", user_id_a: ME, user_id_b: OWNER, status: "pending" }],
      {
        hideNextLookup: true,
      },
    );
    await expect(sendMatchRequest(table.client, OWNER)).resolves.toEqual({
      created: false,
      request: { id: "m1", status: "pending", sentByMe: true },
    });
    expect(table.rows).toHaveLength(1);
  });

  it("creates exactly one row for two simultaneous sends", async () => {
    const table = fakeTable();
    const results = await Promise.all([
      sendMatchRequest(table.client, OWNER),
      sendMatchRequest(table.client, OWNER),
    ]);
    expect(table.rows).toHaveLength(1);
    expect(results.every((r) => r.request.id === "m1")).toBe(true);
  });

  it("refuses requests to oneself before and at the database", async () => {
    const table = fakeTable();
    await expect(sendMatchRequest(table.client, ME)).rejects.toMatchObject({
      kind: "self",
      message: sendRequestMessages.self,
    });
    expect(table.inserts).toEqual([]);

    const dbCheck = fakeTable([], {
      insertError: { code: "23514", message: "check" },
    });
    await expect(sendMatchRequest(dbCheck.client, OWNER)).rejects.toMatchObject(
      { kind: "self" },
    );
  });

  it("requires a signed-in user", async () => {
    const table = signedOut(fakeTable());
    await expect(sendMatchRequest(table.client, OWNER)).rejects.toMatchObject({
      kind: "signed-out",
    });
    expect(table.inserts).toEqual([]);
  });

  it("maps failures to Android's safe copy", async () => {
    const failed = fakeTable([], {
      insertError: { code: "42501", message: "rls" },
    });
    const error = await sendMatchRequest(failed.client, OWNER).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(SendRequestError);
    expect(error).toMatchObject({
      kind: "failed",
      message: "Zahteve ni bilo mogoče poslati.",
    });

    const offline = fakeTable([], {
      lookupError: new TypeError("Failed to fetch"),
    });
    await expect(sendMatchRequest(offline.client, OWNER)).rejects.toMatchObject(
      { kind: "offline" },
    );
  });
});

describe("loadRequestState", () => {
  it("reports no request, an existing one, the own listing, or signed out", async () => {
    expect(await loadRequestState(fakeTable().client, OWNER)).toEqual({
      kind: "none",
    });
    expect(
      await loadRequestState(
        fakeTable([
          { id: "m1", user_id_a: OWNER, user_id_b: ME, status: "accepted" },
        ]).client,
        OWNER,
      ),
    ).toEqual({
      kind: "exists",
      request: { id: "m1", status: "accepted", sentByMe: false },
    });
    expect(await loadRequestState(fakeTable().client, ME)).toEqual({
      kind: "own-listing",
    });
    expect(
      await loadRequestState(signedOut(fakeTable()).client, OWNER),
    ).toEqual({
      kind: "signed-out",
    });
  });

  it("maps lookup failures", async () => {
    await expect(
      loadRequestState(
        fakeTable([], { lookupError: new TypeError("Failed to fetch") }).client,
        OWNER,
      ),
    ).rejects.toMatchObject({ kind: "offline" });
  });
});

describe("existingRequestMessage", () => {
  it.each([
    [
      { status: "pending", sentByMe: true },
      "Zahtevo si že poslal(a). Čaka na odgovor.",
    ],
    [
      { status: "pending", sentByMe: false },
      "Ta oseba ti je že poslala zahtevo. Odgovori nanjo med klepeti.",
    ],
    [
      { status: "accepted", sentByMe: true },
      "Že sta povezana. Klepet najdeš med klepeti.",
    ],
    [
      { status: "rejected", sentByMe: true },
      "Ta oseba je tvojo zahtevo zavrnila.",
    ],
    [{ status: "rejected", sentByMe: false }, "To zahtevo si že zavrnil(a)."],
  ] as const)("%o → %s", (request, message) => {
    expect(existingRequestMessage({ id: "m1", ...request })).toBe(message);
  });
});
