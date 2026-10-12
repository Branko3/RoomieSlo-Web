import { mapListing, type Listing } from "../supabase/mappers";
import type { Row } from "../supabase/types";

type DbError = { code?: string; message?: string; status?: number } | null;

/** Same listing columns as the feed, so a favorite card matches the list card (Android parity). */
export const FAVORITE_WITH_LISTING =
  "listing_id,listings(id,owner_id,location,price_per_month,description,is_filled,version,created_at,title,room_type,district,available_from,size_sqm,deposit,bills_included,furnished,flatmates_count,photo_url)";

type FavoriteRow = { listing_id: string; listings?: Row<"listings"> | null };

/** Structural subset of the Supabase client used for favorites. */
export type FavoritesClient = {
  from: (table: "favorites") => {
    select: (columns: string) => {
      eq: (
        column: "profile_id",
        value: string,
      ) => PromiseLike<{ data: FavoriteRow[] | null; error: DbError }>;
    };
    insert: (row: {
      profile_id: string;
      listing_id: string;
    }) => PromiseLike<{ error: DbError }>;
    delete: () => {
      eq: (
        column: "profile_id",
        value: string,
      ) => {
        eq: (
          column: "listing_id",
          value: string,
        ) => PromiseLike<{ error: DbError }>;
      };
    };
  };
};

export type FavoriteErrorKind = "permission" | "gone" | "offline" | "unknown";

export const favoriteErrorMessages: Record<FavoriteErrorKind, string> = {
  permission: "Za shranjevanje priljubljenih se moraš znova prijaviti.",
  gone: "Oglas ne obstaja več, zato ga ni mogoče shraniti.",
  offline: "Ni povezave. Priljubljeni oglas ni bil shranjen.",
  unknown: "Priljubljenih ni bilo mogoče posodobiti.",
};

export class FavoriteError extends Error {
  constructor(public readonly kind: FavoriteErrorKind) {
    super(favoriteErrorMessages[kind]);
    this.name = "FavoriteError";
  }
}

export function toFavoriteError(error: unknown): FavoriteError {
  if (error instanceof FavoriteError) return error;
  const details = (error ?? {}) as {
    code?: string;
    status?: number;
    message?: string;
  };
  if (
    details.code === "42501" ||
    details.status === 401 ||
    details.status === 403
  ) {
    return new FavoriteError("permission");
  }
  // 23503: the listing was deleted (foreign key violation).
  if (details.code === "23503") return new FavoriteError("gone");
  if (
    error instanceof TypeError ||
    /fetch|network/i.test(details.message ?? "")
  ) {
    return new FavoriteError("offline");
  }
  return new FavoriteError("unknown");
}

/** Ids of the current user's favorite listings. */
export async function fetchFavoriteIds(
  client: FavoritesClient,
  userId: string,
): Promise<string[]> {
  try {
    const { data, error } = await client
      .from("favorites")
      .select("listing_id")
      .eq("profile_id", userId);
    if (error) throw error;
    return (data ?? []).map((row) => row.listing_id);
  } catch (error) {
    throw toFavoriteError(error);
  }
}

/**
 * The current user's favorite listings in one request (Android
 * `getMyFavorites`). Rows whose listing is no longer visible are skipped.
 */
export async function fetchFavoriteListings(
  client: FavoritesClient,
  userId: string,
): Promise<Listing[]> {
  try {
    const { data, error } = await client
      .from("favorites")
      .select(FAVORITE_WITH_LISTING)
      .eq("profile_id", userId);
    if (error) throw error;
    return (data ?? []).flatMap((row) =>
      row.listings ? [mapListing(row.listings)] : [],
    );
  } catch (error) {
    throw toFavoriteError(error);
  }
}

/** Saves a favorite; saving one that already exists (23505) counts as success. */
export async function addFavorite(
  client: FavoritesClient,
  userId: string,
  listingId: string,
): Promise<void> {
  try {
    const { error } = await client
      .from("favorites")
      .insert({ profile_id: userId, listing_id: listingId });
    if (error && error.code !== "23505") throw error;
  } catch (error) {
    throw toFavoriteError(error);
  }
}

/** Removes a favorite; removing one that does not exist is a no-op. */
export async function removeFavorite(
  client: FavoritesClient,
  userId: string,
  listingId: string,
): Promise<void> {
  try {
    const { error } = await client
      .from("favorites")
      .delete()
      .eq("profile_id", userId)
      .eq("listing_id", listingId);
    if (error) throw error;
  } catch (error) {
    throw toFavoriteError(error);
  }
}
