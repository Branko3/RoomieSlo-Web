"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { createSupabaseBrowserClient } from "../supabase/browser";
import { readSessionUserId } from "../supabase/hooks";
import type { Listing } from "../supabase/mappers";
import { fetchMyListings, type MyListingsClient } from "./my-listings";

/** Sign-out clears the query cache, so the key needs no user id. */
export const MY_LISTINGS_KEY = ["listings", "mine"] as const;

/**
 * The signed-in user's own listings. Without a session there is nothing to
 * show (the route guard normally prevents that), so it resolves to [].
 * Refetches on every mount, so a listing created, edited or deleted
 * elsewhere is current when the user comes back.
 */
export function useMyListings() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: MY_LISTINGS_KEY,
    queryFn: async () => {
      const ownerId = await readSessionUserId();
      if (!ownerId) return [];
      return fetchMyListings(
        createSupabaseBrowserClient() as unknown as MyListingsClient,
        ownerId,
      );
    },
  });
  /** Applies a confirmed (or optimistic) status change without refetching. */
  const setFilled = useCallback(
    (listingId: string, isFilled: boolean) =>
      queryClient.setQueryData<Listing[]>(MY_LISTINGS_KEY, (current) =>
        current?.map((listing) =>
          listing.id === listingId ? { ...listing, isFilled } : listing,
        ),
      ),
    [queryClient],
  );
  return { ...query, setFilled };
}
