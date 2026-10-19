import { mapListing, type Listing } from "../supabase/mappers";
import type { Row } from "../supabase/types";

/** One person has only a few listings; this cap keeps a runaway account bounded. */
export const MY_LISTINGS_LIMIT = 50;

type QueryResult = { data: Row<"listings">[] | null; error: unknown };

/** Chainable subset of the PostgREST builder used for "Moji oglasi". */
export type MyListingsBuilder = PromiseLike<QueryResult> & {
  select: (columns: string) => MyListingsBuilder;
  eq: (column: string, value: unknown) => MyListingsBuilder;
  order: (column: string, options: { ascending: boolean }) => MyListingsBuilder;
  limit: (count: number) => MyListingsBuilder;
};

export type MyListingsClient = {
  from: (table: "listings") => MyListingsBuilder;
};

/**
 * Every listing the user owns, filled ones included (the browsing feeds only
 * show available listings, so this is the way back to a filled one). Available
 * first, then newest. RLS lets any signed-in user read listings; the owner
 * filter is what makes the list "mine".
 */
export async function fetchMyListings(
  client: MyListingsClient,
  ownerId: string,
): Promise<Listing[]> {
  if (!ownerId) throw new Error("Owner id is required");
  const { data, error } = await client
    .from("listings")
    .select("*")
    .eq("owner_id", ownerId)
    .order("is_filled", { ascending: true })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(MY_LISTINGS_LIMIT);
  if (error) throw error;
  return (data ?? []).map((row) => mapListing(row));
}

/** Splits the user's listings into available and filled, keeping the order. */
export function groupMyListings(listings: readonly Listing[]): {
  available: Listing[];
  filled: Listing[];
} {
  return {
    available: listings.filter((listing) => !listing.isFilled),
    filled: listings.filter((listing) => listing.isFilled),
  };
}

/**
 * Slovenian count of active listings: "1 aktiven oglas", "2 aktivna oglasa",
 * "3 aktivni oglasi", "5 aktivnih oglasov". The form follows the last two
 * digits, like `listingCountLabel`.
 */
export function activeListingsLabel(count: number): string {
  const lastTwo = Math.abs(Math.trunc(count)) % 100;
  if (lastTwo === 1) return `${count} aktiven oglas`;
  if (lastTwo === 2) return `${count} aktivna oglasa`;
  if (lastTwo === 3 || lastTwo === 4) return `${count} aktivni oglasi`;
  return `${count} aktivnih oglasov`;
}

/** "1 zapolnjen", "2 zapolnjena", "3 zapolnjeni", "5 zapolnjenih". */
export function filledListingsLabel(count: number): string {
  const lastTwo = Math.abs(Math.trunc(count)) % 100;
  if (lastTwo === 1) return `${count} zapolnjen`;
  if (lastTwo === 2) return `${count} zapolnjena`;
  if (lastTwo === 3 || lastTwo === 4) return `${count} zapolnjeni`;
  return `${count} zapolnjenih`;
}

/** Header line for "Moji oglasi", e.g. "2 aktivna oglasa, 1 zapolnjen". */
export function myListingsSummary(listings: readonly Listing[]): string {
  const { available, filled } = groupMyListings(listings);
  const active = activeListingsLabel(available.length);
  return filled.length > 0
    ? `${active}, ${filledListingsLabel(filled.length)}`
    : active;
}
