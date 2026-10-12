import { describe, expect, it, vi } from "vitest";
import { writeListingsToCache } from "../lib/listings/cache-sync";
import { getListingCacheStore } from "../lib/listings/indexeddb-store";
import {
  cacheListingsPage,
  createMemoryListingStore,
  lastSyncedAt,
  readCachedListings,
  removeCachedListing,
  replaceCachedListings,
  STALE_AFTER_MS,
  type ListingCacheStore,
} from "../lib/listings/listing-cache";
import type { Listing } from "../lib/supabase/mappers";

const USER = "user-1";
const NOW = Date.UTC(2026, 9, 11, 12);
const DAY = 24 * 60 * 60 * 1000;

function listing(id: string, overrides: Partial<Listing> = {}): Listing {
  return {
    id,
    ownerId: "owner-1",
    title: `Soba ${id}`,
    district: "Center",
    location: "Ljubljana",
    price: 400,
    available: "po dogovoru",
    availableFrom: null,
    roomType: "soba",
    details: "",
    image: "🏠",
    isFilled: false,
    createdAt: `2026-10-0${id.charCodeAt(0) % 9 || 1}T00:00:00Z`,
    ...overrides,
  };
}

const ids = (rows: { listing: Listing }[]) => rows.map((row) => row.listing.id);

describe("cacheListingsPage", () => {
  it("stores fetched listings for the signed-in user", async () => {
    const store = createMemoryListingStore();
    await expect(
      cacheListingsPage(store, [listing("a"), listing("b")], USER, NOW),
    ).resolves.toBe(true);
    expect(await store.getOwner()).toBe(USER);
    expect(
      (await store.getAll()).map((r) => [r.listing.id, r.lastSyncedAt]),
    ).toEqual([
      ["a", NOW],
      ["b", NOW],
    ]);
  });

  it("never writes or deletes without a signed-in user", async () => {
    const store = createMemoryListingStore();
    await cacheListingsPage(store, [listing("a")], USER, NOW);
    await expect(
      cacheListingsPage(store, [], null, NOW + 30 * DAY),
    ).resolves.toBe(false);
    expect(ids(await store.getAll())).toEqual(["a"]);
  });

  it("keeps rows from other searches but drops rows older than seven days", async () => {
    const store = createMemoryListingStore();
    await cacheListingsPage(
      store,
      [listing("old")],
      USER,
      NOW - STALE_AFTER_MS - 1,
    );
    await cacheListingsPage(store, [listing("recent")], USER, NOW - DAY);
    await cacheListingsPage(store, [listing("fresh")], USER, NOW);
    expect(ids(await store.getAll()).sort()).toEqual(["fresh", "recent"]);
  });

  it("keeps a row exactly at the stale boundary", async () => {
    const store = createMemoryListingStore();
    await cacheListingsPage(
      store,
      [listing("edge")],
      USER,
      NOW - STALE_AFTER_MS,
    );
    await cacheListingsPage(store, [], USER, NOW);
    expect(ids(await store.getAll())).toEqual(["edge"]);
  });

  it("refreshes an existing row instead of duplicating it", async () => {
    const store = createMemoryListingStore();
    await cacheListingsPage(
      store,
      [listing("a", { price: 300 })],
      USER,
      NOW - DAY,
    );
    await cacheListingsPage(store, [listing("a", { price: 350 })], USER, NOW);
    const rows = await store.getAll();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      lastSyncedAt: NOW,
      listing: { price: 350 },
    });
  });

  it("discards another user's cache before storing", async () => {
    const store = createMemoryListingStore();
    await cacheListingsPage(store, [listing("a")], "user-1", NOW);
    await cacheListingsPage(store, [listing("b")], "user-2", NOW);
    expect(await store.getOwner()).toBe("user-2");
    expect(ids(await store.getAll())).toEqual(["b"]);
  });
});

describe("replaceCachedListings", () => {
  it("removes listings the full server result no longer contains", async () => {
    const store = createMemoryListingStore();
    await cacheListingsPage(
      store,
      [listing("a"), listing("b"), listing("c")],
      USER,
      NOW - DAY,
    );
    await replaceCachedListings(store, [listing("b"), listing("d")], USER, NOW);
    expect(ids(await store.getAll()).sort()).toEqual(["b", "d"]);
  });

  it("empties the cache for an authenticated empty result", async () => {
    const store = createMemoryListingStore();
    await cacheListingsPage(store, [listing("a")], USER, NOW);
    await replaceCachedListings(store, [], USER, NOW);
    expect(await store.getAll()).toEqual([]);
  });

  it("never replaces valid data with an unauthenticated empty response", async () => {
    const store = createMemoryListingStore();
    await cacheListingsPage(store, [listing("a")], USER, NOW);
    await expect(replaceCachedListings(store, [], null, NOW)).resolves.toBe(
      false,
    );
    expect(ids(await store.getAll())).toEqual(["a"]);
  });
});

describe("readCachedListings", () => {
  async function seeded() {
    const store = createMemoryListingStore();
    await cacheListingsPage(
      store,
      [
        listing("a", {
          createdAt: "2026-10-01T00:00:00Z",
          location: "Ljubljana, Vič",
          price: 300,
        }),
        listing("b", {
          createdAt: "2026-10-03T00:00:00Z",
          location: "Maribor",
          price: 250,
        }),
        listing("c", {
          createdAt: "2026-10-02T00:00:00Z",
          location: "ljubljana",
          price: 500,
        }),
        listing("d", { createdAt: "2026-10-04T00:00:00Z", isFilled: true }),
        listing("e", {
          createdAt: "2026-10-02T00:00:00Z",
          location: "Ljubljana",
          price: 450,
        }),
      ],
      USER,
      NOW,
    );
    return store;
  }

  it("returns available listings newest first with an id tie-breaker", async () => {
    expect(ids(await readCachedListings(await seeded(), USER))).toEqual([
      "b",
      "e",
      "c",
      "a",
    ]);
  });

  it("filters by case-insensitive location substring and maximum price like Android", async () => {
    const store = await seeded();
    expect(
      ids(await readCachedListings(store, USER, { location: " UBLJAN " })),
    ).toEqual(["e", "c", "a"]);
    expect(
      ids(await readCachedListings(store, USER, { maxPrice: 300 })),
    ).toEqual(["b", "a"]);
    expect(
      ids(
        await readCachedListings(store, USER, {
          location: "ljubljana",
          maxPrice: 450,
        }),
      ),
    ).toEqual(["e", "a"]);
  });

  it("applies the limit", async () => {
    expect(
      ids(await readCachedListings(await seeded(), USER, { limit: 2 })),
    ).toEqual(["b", "e"]);
    expect(
      await readCachedListings(await seeded(), USER, { limit: -1 }),
    ).toEqual([]);
  });

  it("returns nothing for a signed-out visitor or another user", async () => {
    const store = await seeded();
    expect(await readCachedListings(store, null)).toEqual([]);
    expect(await readCachedListings(store, "user-2")).toEqual([]);
  });

  it("reports the latest sync time", async () => {
    const store = createMemoryListingStore();
    await cacheListingsPage(store, [listing("a")], USER, NOW - DAY);
    await cacheListingsPage(store, [listing("b")], USER, NOW);
    expect(lastSyncedAt(await readCachedListings(store, USER))).toBe(NOW);
    expect(lastSyncedAt([])).toBeNull();
  });
});

describe("removeCachedListing", () => {
  it("removes a single listing", async () => {
    const store = createMemoryListingStore();
    await cacheListingsPage(store, [listing("a"), listing("b")], USER, NOW);
    await removeCachedListing(store, "a");
    expect(ids(await store.getAll())).toEqual(["b"]);
  });
});

describe("writeListingsToCache", () => {
  it("caches fresh results for the session user", async () => {
    const store = createMemoryListingStore();
    await expect(
      writeListingsToCache([listing("a")], async () => USER, store, NOW),
    ).resolves.toBe(true);
    expect(ids(await store.getAll())).toEqual(["a"]);
  });

  it("does nothing without a session", async () => {
    const store = createMemoryListingStore();
    await expect(
      writeListingsToCache([listing("a")], async () => null, store),
    ).resolves.toBe(false);
    expect(await store.getAll()).toEqual([]);
  });

  it("swallows session and storage failures", async () => {
    const failing: ListingCacheStore = {
      ...createMemoryListingStore(),
      putAll: vi.fn().mockRejectedValue(new Error("QuotaExceededError")),
    };
    await expect(
      writeListingsToCache([listing("a")], async () => USER, failing),
    ).resolves.toBe(false);
    await expect(
      writeListingsToCache(
        [listing("a")],
        () => Promise.reject(new Error("no session")),
        createMemoryListingStore(),
      ),
    ).resolves.toBe(false);
  });
});

describe("getListingCacheStore", () => {
  it("falls back to an in-memory store when IndexedDB is unavailable", async () => {
    expect(typeof indexedDB).toBe("undefined");
    const store = getListingCacheStore();
    expect(getListingCacheStore()).toBe(store);
    await cacheListingsPage(store, [listing("a")], USER, NOW);
    expect(ids(await readCachedListings(store, USER))).toEqual(["a"]);
  });
});
