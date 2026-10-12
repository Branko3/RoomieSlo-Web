import { describe, expect, it, vi } from "vitest";
import {
  cacheListingsPage,
  createMemoryListingStore,
  type ListingCacheStore,
} from "../lib/listings/listing-cache";
import {
  cacheNotice,
  formatSyncedAt,
  loadListingsWithFallback,
} from "../lib/listings/offline-listings";
import type { Listing } from "../lib/supabase/mappers";

const USER = "user-1";
const NOW = Date.UTC(2026, 9, 11, 12, 0);

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
    createdAt: "2026-10-01T00:00:00Z",
    ...overrides,
  };
}

async function seededStore(rows: Listing[], at = NOW - 3 * 60 * 60 * 1000) {
  const store = createMemoryListingStore();
  await cacheListingsPage(store, rows, USER, at);
  return store;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("loadListingsWithFallback", () => {
  it("shows fresh listings and refreshes the cache", async () => {
    const store = createMemoryListingStore();
    const view = await loadListingsWithFallback({
      fetchFresh: async () => [listing("a")],
      readUserId: async () => USER,
      store,
      now: NOW,
    });
    expect(view).toEqual({ source: "network", listings: [listing("a")] });
    await flush();
    expect((await store.getAll()).map((r) => r.listing.id)).toEqual(["a"]);
  });

  it("trusts an empty successful response instead of showing cached data", async () => {
    const store = await seededStore([listing("a")]);
    const view = await loadListingsWithFallback({
      fetchFresh: async () => [],
      readUserId: async () => USER,
      store,
      now: NOW,
    });
    expect(view).toEqual({ source: "network", listings: [] });
  });

  it("does not let an unauthenticated empty response erase the cache", async () => {
    const store = await seededStore([listing("a")]);
    await loadListingsWithFallback({
      fetchFresh: async () => [],
      readUserId: async () => null,
      store,
      now: NOW,
    });
    await flush();
    expect((await store.getAll()).map((r) => r.listing.id)).toEqual(["a"]);
  });

  it("falls back to cached listings when the request fails", async () => {
    const synced = NOW - 2 * 60 * 60 * 1000;
    const store = await seededStore([listing("a"), listing("b")], synced);
    const view = await loadListingsWithFallback({
      fetchFresh: () => Promise.reject(new TypeError("Failed to fetch")),
      readUserId: async () => USER,
      store,
      now: NOW,
    });
    expect(view).toMatchObject({
      source: "cache",
      syncedAt: synced,
      offline: false,
    });
    expect(view.source === "cache" && view.listings.map((l) => l.id)).toEqual([
      "b",
      "a",
    ]);
  });

  it("skips the network when the browser is offline", async () => {
    const fetchFresh = vi.fn();
    const store = await seededStore([listing("a")]);
    const view = await loadListingsWithFallback({
      fetchFresh,
      readUserId: async () => USER,
      store,
      isOnline: false,
      now: NOW,
    });
    expect(fetchFresh).not.toHaveBeenCalled();
    expect(view).toMatchObject({ source: "cache", offline: true });
  });

  it("applies the same filters to cached listings", async () => {
    const store = await seededStore([
      listing("a", { location: "Ljubljana", price: 300 }),
      listing("b", { location: "Maribor", price: 300 }),
      listing("c", { location: "Ljubljana", price: 700 }),
      listing("d", { location: "Ljubljana", price: 200, isFilled: true }),
    ]);
    const view = await loadListingsWithFallback({
      fetchFresh: () => Promise.reject(new Error("500")),
      readUserId: async () => USER,
      store,
      query: { location: "ljub", maxPrice: 400 },
      now: NOW,
    });
    expect(view.source === "cache" && view.listings.map((l) => l.id)).toEqual([
      "a",
    ]);
  });

  it("reports the original error when nothing is cached", async () => {
    const failure = new Error("permission denied");
    const view = await loadListingsWithFallback({
      fetchFresh: () => Promise.reject(failure),
      readUserId: async () => USER,
      store: createMemoryListingStore(),
      now: NOW,
    });
    expect(view).toEqual({ source: "error", error: failure, offline: false });
  });

  it("never shows another user's or a signed-out visitor's cache", async () => {
    const store = await seededStore([listing("a")]);
    for (const readUserId of [async () => "user-2", async () => null]) {
      const view = await loadListingsWithFallback({
        fetchFresh: () => Promise.reject(new Error("offline")),
        readUserId,
        store,
        now: NOW,
      });
      expect(view.source).toBe("error");
    }
  });

  it("keeps the original error when the cache itself fails", async () => {
    const broken: ListingCacheStore = {
      ...createMemoryListingStore(),
      getOwner: () => Promise.reject(new Error("IDB closed")),
    };
    const failure = new Error("network");
    await expect(
      loadListingsWithFallback({
        fetchFresh: () => Promise.reject(failure),
        readUserId: async () => USER,
        store: broken,
        now: NOW,
      }),
    ).resolves.toEqual({ source: "error", error: failure, offline: false });
  });

  it("wraps non-Error failures", async () => {
    const view = await loadListingsWithFallback({
      fetchFresh: () => Promise.reject("boom"),
      readUserId: async () => USER,
      store: createMemoryListingStore(),
      now: NOW,
    });
    expect(view.source === "error" && view.error).toBeInstanceOf(Error);
  });
});

describe("cache notice copy", () => {
  it("formats the last sync time", () => {
    expect(formatSyncedAt(null, NOW)).toBe("neznano kdaj");
    expect(formatSyncedAt(NOW - 30_000, NOW)).toBe("pravkar");
    expect(formatSyncedAt(NOW - 5 * 60_000, NOW)).toBe("pred 5 min");
    expect(formatSyncedAt(Date.UTC(2026, 9, 10, 8, 5), NOW)).toMatch(
      /10\. ?10\. ?2026.*10:05/,
    );
  });

  it("explains offline and refresh-failure cache views, and nothing for fresh data", () => {
    const base = { listings: [], syncedAt: NOW - 5 * 60_000 };
    expect(cacheNotice({ source: "cache", offline: true, ...base }, NOW)).toBe(
      "Brez povezave. Prikazujemo shranjene oglase (zadnja posodobitev: pred 5 min).",
    );
    expect(cacheNotice({ source: "cache", offline: false, ...base }, NOW)).toBe(
      "Oglasov trenutno ni mogoče osvežiti. Prikazujemo shranjene oglase (zadnja posodobitev: pred 5 min).",
    );
    expect(cacheNotice({ source: "network", listings: [] }, NOW)).toBeNull();
    expect(
      cacheNotice(
        { source: "error", error: new Error("x"), offline: true },
        NOW,
      ),
    ).toBeNull();
  });
});
