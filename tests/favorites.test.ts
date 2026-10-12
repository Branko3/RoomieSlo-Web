import { describe, expect, it, vi } from "vitest";
import {
  addFavorite,
  FAVORITE_WITH_LISTING,
  favoriteErrorMessages,
  fetchFavoriteIds,
  fetchFavoriteListings,
  removeFavorite,
  toFavoriteError,
  type FavoritesClient,
} from "../lib/favorites/favorites-api";
import {
  adoptServerFavorites,
  LOCAL_FAVORITES_KEY,
  readLocalFavorites,
  toggleFavoriteOptimistically,
} from "../lib/favorites/favorites-sync";
import type { Row } from "../lib/supabase/types";

const USER = "user-1";

function listingRow(id: string): Row<"listings"> {
  return {
    id,
    owner_id: "owner-1",
    location: "Ljubljana",
    price_per_month: 400,
    description: "",
    is_filled: false,
    version: 1,
    created_at: "2026-10-01T00:00:00Z",
    title: `Soba ${id}`,
    room_type: "soba",
    district: "Center",
    available_from: null,
    size_sqm: null,
    deposit: null,
    bills_included: false,
    furnished: false,
    flatmates_count: 0,
    photo_url: "",
  };
}

type Result = { data?: unknown; error: unknown } | Error;
const settle = (result: Result) =>
  result instanceof Error ? Promise.reject(result) : Promise.resolve(result);

/** Fake favorites table that records calls and keeps rows in memory. */
function makeClient({
  rows = [] as string[],
  select,
  insert,
  remove,
}: {
  rows?: string[];
  select?: Result;
  insert?: (listingId: string) => Result;
  remove?: Result;
} = {}) {
  const table = new Set(rows);
  const calls: Array<[string, unknown[]]> = [];
  const client = {
    from: vi.fn((name: string) => {
      calls.push(["from", [name]]);
      return {
        select: (columns: string) => {
          calls.push(["select", [columns]]);
          return {
            eq: (column: string, value: string) => {
              calls.push(["eq", [column, value]]);
              return settle(
                select ?? {
                  data: [...table].map((listing_id) => ({ listing_id })),
                  error: null,
                },
              );
            },
          };
        },
        insert: (row: { profile_id: string; listing_id: string }) => {
          calls.push(["insert", [row]]);
          const result = insert?.(row.listing_id) ?? { error: null };
          if (!(result instanceof Error) && !result.error)
            table.add(row.listing_id);
          return settle(result);
        },
        delete: () => {
          calls.push(["delete", []]);
          return {
            eq: (column: string, value: string) => {
              calls.push(["eq", [column, value]]);
              return {
                eq: (column2: string, value2: string) => {
                  calls.push(["eq", [column2, value2]]);
                  const result = remove ?? { error: null };
                  if (!(result instanceof Error) && !result.error)
                    table.delete(value2);
                  return settle(result);
                },
              };
            },
          };
        },
      };
    }),
  };
  return { client: client as unknown as FavoritesClient, calls, table };
}

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
}

describe("favorites API (Android FavoriteRepository parity)", () => {
  it("lists the current user's favorite ids", async () => {
    const { client, calls } = makeClient({ rows: ["a", "b"] });
    await expect(fetchFavoriteIds(client, USER)).resolves.toEqual(["a", "b"]);
    expect(calls).toEqual([
      ["from", ["favorites"]],
      ["select", ["listing_id"]],
      ["eq", ["profile_id", USER]],
    ]);
  });

  it("loads favorite listings in one nested query and skips hidden listings", async () => {
    const { client, calls } = makeClient({
      select: {
        data: [
          { listing_id: "a", listings: listingRow("a") },
          { listing_id: "gone", listings: null },
        ],
        error: null,
      },
    });
    const listings = await fetchFavoriteListings(client, USER);
    expect(listings.map((l) => l.id)).toEqual(["a"]);
    expect(calls[1]).toEqual(["select", [FAVORITE_WITH_LISTING]]);
    expect(FAVORITE_WITH_LISTING).toContain("listings(id,owner_id");
  });

  it("adds a favorite for the given user and treats duplicates as success", async () => {
    const { client, calls } = makeClient();
    await addFavorite(client, USER, "a");
    expect(calls).toContainEqual([
      "insert",
      [{ profile_id: USER, listing_id: "a" }],
    ]);

    const duplicate = makeClient({
      insert: () => ({ error: { code: "23505" } }),
    });
    await expect(
      addFavorite(duplicate.client, USER, "a"),
    ).resolves.toBeUndefined();
  });

  it("removes only the user's own favorite row", async () => {
    const { client, calls } = makeClient({ rows: ["a"] });
    await removeFavorite(client, USER, "a");
    expect(calls.slice(1)).toEqual([
      ["delete", []],
      ["eq", ["profile_id", USER]],
      ["eq", ["listing_id", "a"]],
    ]);
  });

  it.each([
    [{ code: "42501" }, "permission"],
    [{ status: 401 }, "permission"],
    [{ code: "23503" }, "gone"],
    [new TypeError("Failed to fetch"), "offline"],
    [{ code: "XX000", message: "internal" }, "unknown"],
  ])("maps %o to %s", (error, kind) => {
    const mapped = toFavoriteError(error);
    expect(mapped.kind).toBe(kind);
    expect(mapped.message).toBe(
      favoriteErrorMessages[kind as keyof typeof favoriteErrorMessages],
    );
  });

  it("surfaces mapped errors from the API calls", async () => {
    const { client } = makeClient({
      select: { data: null, error: { code: "42501" } },
    });
    await expect(fetchFavoriteIds(client, USER)).rejects.toMatchObject({
      kind: "permission",
    });
    const offline = makeClient({ remove: new TypeError("Failed to fetch") });
    await expect(
      removeFavorite(offline.client, USER, "a"),
    ).rejects.toMatchObject({
      kind: "offline",
    });
  });
});

describe("readLocalFavorites", () => {
  it("reads unique string ids", () => {
    const storage = memoryStorage({
      [LOCAL_FAVORITES_KEY]: JSON.stringify(["a", "b", "a", 3, ""]),
    });
    expect(readLocalFavorites(storage)).toEqual(["a", "b"]);
  });

  it("discards corrupt data", () => {
    for (const value of ["{not json", JSON.stringify({ a: 1 })]) {
      const storage = memoryStorage({ [LOCAL_FAVORITES_KEY]: value });
      expect(readLocalFavorites(storage)).toEqual([]);
      expect(storage.data.has(LOCAL_FAVORITES_KEY)).toBe(false);
    }
  });

  it("handles missing storage and keys", () => {
    expect(readLocalFavorites(null)).toEqual([]);
    expect(readLocalFavorites(memoryStorage())).toEqual([]);
  });
});

describe("adoptServerFavorites", () => {
  it("uploads browser-only favorites once and clears them locally", async () => {
    const { client, table } = makeClient({ rows: ["a"] });
    const storage = memoryStorage({
      [LOCAL_FAVORITES_KEY]: JSON.stringify(["a", "b"]),
    });
    await expect(adoptServerFavorites(client, USER, storage)).resolves.toEqual([
      "a",
      "b",
    ]);
    expect([...table].sort()).toEqual(["a", "b"]);
    expect(storage.data.has(LOCAL_FAVORITES_KEY)).toBe(false);
  });

  it("skips listings deleted meanwhile and still clears local data", async () => {
    const { client } = makeClient({
      insert: (id) =>
        id === "gone" ? { error: { code: "23503" } } : { error: null },
    });
    const storage = memoryStorage({
      [LOCAL_FAVORITES_KEY]: JSON.stringify(["gone", "b"]),
    });
    await expect(adoptServerFavorites(client, USER, storage)).resolves.toEqual([
      "b",
    ]);
    expect(storage.data.has(LOCAL_FAVORITES_KEY)).toBe(false);
  });

  it("keeps local favorites when an upload fails for a temporary reason", async () => {
    const { client } = makeClient({
      insert: () => new TypeError("Failed to fetch"),
    });
    const storage = memoryStorage({
      [LOCAL_FAVORITES_KEY]: JSON.stringify(["b"]),
    });
    await expect(adoptServerFavorites(client, USER, storage)).resolves.toEqual(
      [],
    );
    expect(storage.data.get(LOCAL_FAVORITES_KEY)).toBe(JSON.stringify(["b"]));
  });

  it("uses the server list when there is nothing local", async () => {
    const { client, calls } = makeClient({ rows: ["a"] });
    await expect(
      adoptServerFavorites(client, USER, memoryStorage()),
    ).resolves.toEqual(["a"]);
    expect(calls.some(([name]) => name === "insert")).toBe(false);
  });

  it("propagates a failure to load the server list", async () => {
    const { client } = makeClient({ select: new TypeError("Failed to fetch") });
    await expect(
      adoptServerFavorites(client, USER, memoryStorage()),
    ).rejects.toMatchObject({
      kind: "offline",
    });
  });
});

describe("toggleFavoriteOptimistically", () => {
  it("adds immediately and persists the new state", async () => {
    const applied: string[][] = [];
    const persist = vi.fn().mockResolvedValue(undefined);
    const result = await toggleFavoriteOptimistically(
      ["a"],
      "b",
      (f) => applied.push(f),
      persist,
    );
    expect(applied).toEqual([["a", "b"]]);
    expect(persist).toHaveBeenCalledWith("b", true);
    expect(result).toEqual({ ok: true, favorites: ["a", "b"] });
  });

  it("removes immediately and persists the removal", async () => {
    const persist = vi.fn().mockResolvedValue(undefined);
    const result = await toggleFavoriteOptimistically(
      ["a", "b"],
      "a",
      () => {},
      persist,
    );
    expect(persist).toHaveBeenCalledWith("a", false);
    expect(result.favorites).toEqual(["b"]);
  });

  it("rolls back on failure with a mapped error", async () => {
    const applied: string[][] = [];
    const result = await toggleFavoriteOptimistically(
      ["a"],
      "b",
      (f) => applied.push(f),
      () => Promise.reject(new TypeError("Failed to fetch")),
    );
    expect(applied).toEqual([["a", "b"], ["a"]]);
    expect(result).toMatchObject({ ok: false, favorites: ["a"] });
    if (!result.ok) expect(result.error.kind).toBe("offline");
  });

  it("does not undo a toggle made while a failed one was pending", async () => {
    let state: string[] = [];
    const apply = (f: string[]) => {
      state = f;
    };
    let rejectFirst!: (error: unknown) => void;
    const first = toggleFavoriteOptimistically(
      state,
      "a",
      apply,
      () => new Promise<void>((_, reject) => (rejectFirst = reject)),
      () => state,
    );
    await toggleFavoriteOptimistically(
      state,
      "b",
      apply,
      async () => {},
      () => state,
    );
    expect(state).toEqual(["a", "b"]);
    rejectFirst(new Error("500"));
    await first;
    expect(state).toEqual(["b"]);
  });
});
