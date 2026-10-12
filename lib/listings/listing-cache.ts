import type { Listing } from "../supabase/mappers";

/**
 * Browser listing cache (Android Room `ListingDao` parity). Only listings are
 * cached, as the migration plan requires. The cache never treats a missing
 * session as "the server has no listings": without a user nothing is written
 * or deleted, so a signed-out or expired response cannot empty it.
 */

/** Rows not refreshed for this long are dropped (Android `STALE_AFTER_MS`). */
export const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export type CachedListing = { listing: Listing; lastSyncedAt: number };

/** Storage backend; IndexedDB in the browser, memory in tests. */
export type ListingCacheStore = {
  getAll: () => Promise<CachedListing[]>;
  putAll: (rows: CachedListing[]) => Promise<void>;
  deleteIds: (ids: string[]) => Promise<void>;
  clear: () => Promise<void>;
  getOwner: () => Promise<string | null>;
  setOwner: (userId: string) => Promise<void>;
};

/**
 * The cache belongs to one signed-in user. When another user signs in on the
 * same browser, the previous user's cache is discarded before use.
 */
async function claimFor(
  store: ListingCacheStore,
  userId: string,
): Promise<void> {
  const owner = await store.getOwner();
  if (owner !== userId) {
    await store.clear();
    await store.setOwner(userId);
  }
}

/**
 * Stores one (possibly filtered) page and drops rows older than the stale
 * cutoff (Android `syncListings`). Rows outside the filter are kept: they
 * belong to other searches and only expire by age.
 */
export async function cacheListingsPage(
  store: ListingCacheStore,
  listings: readonly Listing[],
  userId: string | null,
  now: number = Date.now(),
): Promise<boolean> {
  if (!userId) return false;
  await claimFor(store, userId);
  await store.putAll(
    listings.map((listing) => ({ listing, lastSyncedAt: now })),
  );
  const cutoff = now - STALE_AFTER_MS;
  const stale = (await store.getAll())
    .filter((row) => row.lastSyncedAt < cutoff)
    .map((row) => row.listing.id);
  if (stale.length) await store.deleteIds(stale);
  return true;
}

/**
 * Replaces the cache with a complete, unfiltered, unlimited result (Android
 * `replaceAll`): listings the server no longer returns are removed at once.
 * Must only be called with the full available-listing set for a signed-in user.
 */
export async function replaceCachedListings(
  store: ListingCacheStore,
  listings: readonly Listing[],
  userId: string | null,
  now: number = Date.now(),
): Promise<boolean> {
  if (!userId) return false;
  await claimFor(store, userId);
  const keep = new Set(listings.map((listing) => listing.id));
  const removed = (await store.getAll())
    .map((row) => row.listing.id)
    .filter((id) => !keep.has(id));
  await store.putAll(
    listings.map((listing) => ({ listing, lastSyncedAt: now })),
  );
  if (removed.length) await store.deleteIds(removed);
  return true;
}

/** Updates a single cached listing, e.g. after it is marked filled or deleted. */
export async function removeCachedListing(
  store: ListingCacheStore,
  id: string,
): Promise<void> {
  await store.deleteIds([id]);
}

export type CachedListingQuery = {
  location?: string;
  maxPrice?: number;
  limit?: number;
};

/**
 * Reads cached available listings like Android `observeListings`: substring
 * location match (case-insensitive), maximum price, newest first, limited.
 * Returns nothing for another user's cache.
 */
export async function readCachedListings(
  store: ListingCacheStore,
  userId: string | null,
  query: CachedListingQuery = {},
): Promise<CachedListing[]> {
  if (!userId || (await store.getOwner()) !== userId) return [];
  const location = query.location?.trim().toLocaleLowerCase("sl") ?? "";
  const rows = (await store.getAll()).filter(
    ({ listing }) =>
      !listing.isFilled &&
      (!location ||
        listing.location.toLocaleLowerCase("sl").includes(location)) &&
      (query.maxPrice === undefined || listing.price <= query.maxPrice),
  );
  rows.sort((a, b) =>
    a.listing.createdAt === b.listing.createdAt
      ? b.listing.id.localeCompare(a.listing.id)
      : b.listing.createdAt.localeCompare(a.listing.createdAt),
  );
  return query.limit === undefined
    ? rows
    : rows.slice(0, Math.max(0, query.limit));
}

/** Time of the most recent sync among the given rows, for "last updated" copy. */
export function lastSyncedAt(rows: readonly CachedListing[]): number | null {
  return rows.reduce<number | null>(
    (latest, row) =>
      latest === null || row.lastSyncedAt > latest ? row.lastSyncedAt : latest,
    null,
  );
}

/** In-memory store for tests and for browsers without IndexedDB. */
export function createMemoryListingStore(): ListingCacheStore {
  const rows = new Map<string, CachedListing>();
  let owner: string | null = null;
  return {
    getAll: async () => [...rows.values()].map((row) => ({ ...row })),
    putAll: async (items) => {
      for (const item of items) rows.set(item.listing.id, { ...item });
    },
    deleteIds: async (ids) => {
      for (const id of ids) rows.delete(id);
    },
    clear: async () => {
      rows.clear();
      owner = null;
    },
    getOwner: async () => owner,
    setOwner: async (userId) => {
      owner = userId;
    },
  };
}
