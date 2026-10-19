import { mapListing, type Listing } from "../supabase/mappers";
import type { Row } from "../supabase/types";

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

/** Position after the last listing of a page, ordered by `created_at desc, id desc`. */
export type ListingCursor = { createdAt: string; id: string };

export type ListingPageQuery = {
  location?: string;
  maxPrice?: number;
  cursor?: ListingCursor | null;
  pageSize?: number;
  /** Leaves out this owner's listings: browsing feeds never show your own ("Moji oglasi" does). */
  excludeOwnerId?: string | null;
};

export type ListingPage = {
  items: Listing[];
  nextCursor: ListingCursor | null;
};

type QueryResult = { data: Row<"listings">[] | null; error: unknown };

/** Chainable subset of the PostgREST builder used for the feed. */
export type ListingPageBuilder = PromiseLike<QueryResult> & {
  select: (columns: string) => ListingPageBuilder;
  eq: (column: string, value: unknown) => ListingPageBuilder;
  neq: (column: string, value: unknown) => ListingPageBuilder;
  order: (
    column: string,
    options: { ascending: boolean },
  ) => ListingPageBuilder;
  limit: (count: number) => ListingPageBuilder;
  ilike: (column: string, pattern: string) => ListingPageBuilder;
  lte: (column: string, value: number) => ListingPageBuilder;
  or: (filters: string) => ListingPageBuilder;
};

export type ListingPageClient = {
  from: (table: "listings") => ListingPageBuilder;
};

export function clampPageSize(size: number | undefined): number {
  if (size === undefined || !Number.isFinite(size)) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(size)));
}

/** PostgREST requires double quotes around values containing `,.:()`; quotes and backslashes are escaped. */
export function quoteFilterValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * Keyset condition for rows strictly after the cursor in `created_at desc, id desc`
 * order. The `id` tie-breaker keeps rows with an identical `created_at` from being
 * skipped or repeated across pages (Android pages by `created_at` alone).
 */
export function cursorFilter(cursor: ListingCursor): string {
  const createdAt = quoteFilterValue(cursor.createdAt);
  const id = quoteFilterValue(cursor.id);
  return `created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${id})`;
}

/**
 * Loads one page of available listings. One extra row is requested to know
 * whether another page exists, so the last page needs no empty follow-up request.
 */
export async function fetchListingsPage(
  client: ListingPageClient,
  query: ListingPageQuery = {},
): Promise<ListingPage> {
  const pageSize = clampPageSize(query.pageSize);
  let request = client
    .from("listings")
    .select("*")
    .eq("is_filled", false)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(pageSize + 1);
  const location = query.location?.trim();
  if (location) request = request.ilike("location", `%${location}%`);
  if (query.maxPrice !== undefined)
    request = request.lte("price_per_month", query.maxPrice);
  if (query.excludeOwnerId)
    request = request.neq("owner_id", query.excludeOwnerId);
  if (query.cursor) request = request.or(cursorFilter(query.cursor));

  const { data, error } = await request;
  if (error) throw error;
  const rows = data ?? [];
  const items = rows.slice(0, pageSize).map((row) => mapListing(row));
  const last = items[items.length - 1];
  return {
    items,
    nextCursor:
      rows.length > pageSize && last
        ? { createdAt: last.createdAt, id: last.id }
        : null,
  };
}

/** Flattens loaded pages, dropping any listing already shown (e.g. after concurrent inserts). */
export function flattenPages(pages: readonly ListingPage[]): Listing[] {
  const seen = new Set<string>();
  const listings: Listing[] = [];
  for (const page of pages) {
    for (const listing of page.items) {
      if (seen.has(listing.id)) continue;
      seen.add(listing.id);
      listings.push(listing);
    }
  }
  return listings;
}
