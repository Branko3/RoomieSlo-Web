import type { Listing } from "../supabase/mappers";
import { writeListingsToCache, type SessionReader } from "./cache-sync";
import {
  lastSyncedAt,
  readCachedListings,
  type CachedListingQuery,
  type ListingCacheStore,
} from "./listing-cache";

export type ListingsView =
  | { source: "network"; listings: Listing[] }
  | {
      source: "cache";
      listings: Listing[];
      syncedAt: number | null;
      offline: boolean;
    }
  | { source: "error"; error: Error; offline: boolean };

export type LoadListingsOptions = {
  fetchFresh: () => Promise<Listing[]>;
  readUserId: SessionReader;
  store: ListingCacheStore;
  query?: CachedListingQuery;
  /** `navigator.onLine`; when false the network is skipped instead of waiting for a timeout. */
  isOnline?: boolean;
  now?: number;
};

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error("Listing query failed");
}

/**
 * Loads listings from the server and keeps the cache fresh; when the server is
 * unreachable or fails, shows the signed-in user's cached listings instead
 * (Android shows the Room cache and keeps it on refresh errors). A successful
 * response always wins, even when empty, and never touches the cache without a
 * session, so an unauthenticated empty response cannot hide valid cached data.
 */
export async function loadListingsWithFallback({
  fetchFresh,
  readUserId,
  store,
  query,
  isOnline = true,
  now = Date.now(),
}: LoadListingsOptions): Promise<ListingsView> {
  let failure: Error;
  if (isOnline) {
    try {
      const listings = await fetchFresh();
      void writeListingsToCache(listings, readUserId, store, now);
      return { source: "network", listings };
    } catch (error) {
      failure = asError(error);
    }
  } else {
    failure = new Error("Offline");
  }

  try {
    const userId = await readUserId();
    const cached = await readCachedListings(store, userId, query);
    if (cached.length > 0) {
      return {
        source: "cache",
        listings: cached.map((row) => row.listing),
        syncedAt: lastSyncedAt(cached),
        offline: !isOnline,
      };
    }
  } catch {
    // An unreadable cache must not hide the original failure.
  }
  return { source: "error", error: failure, offline: !isOnline };
}

const syncFormatter = new Intl.DateTimeFormat("sl-SI", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Ljubljana",
});

/** Slovenian "last updated" text for cached data. */
export function formatSyncedAt(
  syncedAt: number | null,
  now: number = Date.now(),
): string {
  if (syncedAt === null) return "neznano kdaj";
  const minutes = Math.floor((now - syncedAt) / 60_000);
  if (minutes < 1) return "pravkar";
  if (minutes < 60) return `pred ${minutes} min`;
  return syncFormatter.format(new Date(syncedAt));
}

/** Banner copy for a cached view; `null` when showing fresh data. */
export function cacheNotice(
  view: ListingsView,
  now: number = Date.now(),
): string | null {
  if (view.source !== "cache") return null;
  const when = formatSyncedAt(view.syncedAt, now);
  return view.offline
    ? `Brez povezave. Prikazujemo shranjene oglase (zadnja posodobitev: ${when}).`
    : `Oglasov trenutno ni mogoče osvežiti. Prikazujemo shranjene oglase (zadnja posodobitev: ${when}).`;
}
