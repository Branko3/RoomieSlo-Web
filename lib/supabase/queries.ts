import { createSupabaseBrowserClient } from "./browser";
import { mapListing, mapProfile, type Listing, type Profile } from "./mappers";

export type ListingQuery = {
  location?: string;
  maxPrice?: number;
  cursor?: string;
  limit?: number;
};

export async function fetchListings(
  query: ListingQuery = {},
): Promise<Listing[]> {
  const client = createSupabaseBrowserClient();
  let request = client
    .from("listings")
    .select("*")
    .eq("is_filled", false)
    .order("created_at", { ascending: false })
    .limit(query.limit ?? 24);
  if (query.location?.trim())
    request = request.ilike("location", `%${query.location.trim()}%`);
  if (query.maxPrice !== undefined)
    request = request.lte("price_per_month", query.maxPrice);
  if (query.cursor) request = request.lt("created_at", query.cursor);
  const { data, error } = await request;
  if (error) throw error;
  return (data ?? []).map((row) => mapListing(row));
}

export async function fetchListing(id: string): Promise<Listing | null> {
  if (!id) throw new Error("Listing id is required");
  const { data, error } = await createSupabaseBrowserClient()
    .from("listings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapListing(data) : null;
}

export async function fetchProfiles(): Promise<Profile[]> {
  const { data, error } = await createSupabaseBrowserClient()
    .from("profiles")
    .select("*");
  if (error) throw error;
  return (data ?? []).map(mapProfile);
}
