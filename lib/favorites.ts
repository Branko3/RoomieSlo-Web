/** localStorage key of the favorites prototype (kept for existing saved data). */
export const FAVORITES_KEY = "roomieslo:favorites";

/**
 * Reads saved favorites. Returns null when the value is unusable (bad JSON or
 * not a list of ids), so the caller can discard it; duplicates and empty ids
 * are dropped.
 */
export function parseFavorites(raw: string | null): string[] | null {
  if (raw === null) return [];
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(value)) return null;
  const ids = value.filter(
    (id): id is string => typeof id === "string" && id.length > 0,
  );
  return [...new Set(ids)];
}

export function serializeFavorites(favorites: readonly string[]): string {
  return JSON.stringify(favorites);
}

/** Adds the listing at the end, or removes it if already saved. */
export function toggleFavoriteId(
  favorites: readonly string[],
  listingId: string,
): string[] {
  return favorites.includes(listingId)
    ? favorites.filter((id) => id !== listingId)
    : [...favorites, listingId];
}
