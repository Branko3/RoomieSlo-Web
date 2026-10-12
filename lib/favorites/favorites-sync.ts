import {
  addFavorite,
  fetchFavoriteIds,
  toFavoriteError,
  type FavoriteError,
  type FavoritesClient,
} from "./favorites-api";

export const LOCAL_FAVORITES_KEY = "roomieslo:favorites";

/** Reads prototype favorites saved in localStorage; corrupt data is discarded. */
export function readLocalFavorites(
  storage: Pick<Storage, "getItem" | "removeItem"> | null,
): string[] {
  if (!storage) return [];
  const saved = storage.getItem(LOCAL_FAVORITES_KEY);
  if (!saved) return [];
  try {
    const parsed: unknown = JSON.parse(saved);
    if (Array.isArray(parsed)) {
      return [
        ...new Set(
          parsed.filter(
            (id): id is string => typeof id === "string" && id.length > 0,
          ),
        ),
      ];
    }
  } catch {
    // fall through
  }
  storage.removeItem(LOCAL_FAVORITES_KEY);
  return [];
}

/**
 * Signs a user into server-backed favorites: favorites saved in this browser
 * before signing in are uploaded once (listings deleted meanwhile are skipped),
 * then the server list becomes the source of truth. Local ids are cleared only
 * after every upload either succeeded or was permanently impossible, so a
 * network failure never loses them.
 */
export async function adoptServerFavorites(
  client: FavoritesClient,
  userId: string,
  storage: Pick<Storage, "getItem" | "removeItem"> | null,
): Promise<string[]> {
  const server = await fetchFavoriteIds(client, userId);
  const local = readLocalFavorites(storage);
  const missing = local.filter((id) => !server.includes(id));
  const uploaded: string[] = [];
  let keepLocal = false;
  for (const id of missing) {
    try {
      await addFavorite(client, userId, id);
      uploaded.push(id);
    } catch (error) {
      if (toFavoriteError(error).kind !== "gone") keepLocal = true;
    }
  }
  if (!keepLocal && local.length > 0) storage?.removeItem(LOCAL_FAVORITES_KEY);
  return [...server, ...uploaded];
}

export type ToggleResult =
  | { ok: true; favorites: string[] }
  | { ok: false; error: FavoriteError; favorites: string[] };

function withFavorite(
  favorites: readonly string[],
  listingId: string,
  favorite: boolean,
): string[] {
  const without = favorites.filter((id) => id !== listingId);
  return favorite ? [...without, listingId] : without;
}

/**
 * Optimistic favorite toggle: the new list is applied at once, then persisted.
 * On failure only this listing is restored, against the list as it is now
 * (`getCurrent`), so a failed toggle never undoes another toggle made meanwhile.
 */
export async function toggleFavoriteOptimistically(
  current: readonly string[],
  listingId: string,
  apply: (favorites: string[]) => void,
  persist: (listingId: string, favorite: boolean) => Promise<void>,
  getCurrent: () => readonly string[] = () => current,
): Promise<ToggleResult> {
  const wasFavorite = current.includes(listingId);
  const next = withFavorite(current, listingId, !wasFavorite);
  apply(next);
  try {
    await persist(listingId, !wasFavorite);
    return { ok: true, favorites: next };
  } catch (error) {
    const restored = withFavorite(getCurrent(), listingId, wasFavorite);
    apply(restored);
    return { ok: false, error: toFavoriteError(error), favorites: restored };
  }
}
