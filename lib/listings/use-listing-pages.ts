"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { createSupabaseBrowserClient } from "../supabase/browser";
import {
  DEFAULT_PAGE_SIZE,
  fetchListingsPage,
  flattenPages,
  type ListingCursor,
  type ListingPageClient,
} from "./pagination";

/** Paged listing feed for the given filters; a filter change starts again from the first page. */
export function useListingPages(filters: {
  location?: string;
  maxPrice?: number;
}) {
  const location = filters.location?.trim() ?? "";
  const query = useInfiniteQuery({
    queryKey: ["listings", "feed", location, filters.maxPrice ?? null],
    initialPageParam: null as ListingCursor | null,
    queryFn: ({ pageParam }) =>
      fetchListingsPage(
        createSupabaseBrowserClient() as unknown as ListingPageClient,
        {
          location,
          maxPrice: filters.maxPrice,
          cursor: pageParam,
          pageSize: DEFAULT_PAGE_SIZE,
        },
      ),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
  const listings = useMemo(
    () => flattenPages(query.data?.pages ?? []),
    [query.data],
  );
  return { ...query, listings };
}
