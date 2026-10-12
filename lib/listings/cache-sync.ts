import type { Listing } from "../supabase/mappers";
import { cacheListingsPage, type ListingCacheStore } from "./listing-cache";

/** Reads the signed-in user id from the locally stored session (no network). */
export type SessionReader = () => Promise<string | null>;

/**
 * Saves a successfully fetched page to the browser cache for the signed-in
 * user. Caching is best effort: a missing session or a storage failure never
 * affects the page that showed the fresh data.
 */
export async function writeListingsToCache(
  listings: readonly Listing[],
  readUserId: SessionReader,
  store: ListingCacheStore,
  now: number = Date.now(),
): Promise<boolean> {
  try {
    const userId = await readUserId();
    return await cacheListingsPage(store, listings, userId, now);
  } catch {
    return false;
  }
}
