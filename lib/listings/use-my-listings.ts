"use client";

import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../supabase/browser";
import { readSessionUserId } from "../supabase/hooks";
import type { Listing } from "../supabase/mappers";
import { fetchMyListings, type MyListingsClient } from "./my-listings";

/**
 * The signed-in user's own listings, loaded on mount (so a listing created,
 * edited or deleted elsewhere is current when the user comes back). Without a
 * session there is nothing to show; the route guard normally prevents that.
 *
 * A plain hook like `useListings`/`useListing` rather than TanStack Query:
 * using `useQuery` on /listings and /profile regrouped Query's shared chunks
 * and pushed /chats/[matchId] over the first-load budget.
 */
export function useMyListings() {
  const [state, setState] = useState<{
    data?: Listing[];
    isPending: boolean;
    error: Error | null;
  }>({ isPending: true, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setState((current) => ({
      ...current,
      isPending: !current.data,
      error: null,
    }));
    (async () => {
      const ownerId = await readSessionUserId();
      return ownerId
        ? fetchMyListings(
            createSupabaseBrowserClient() as unknown as MyListingsClient,
            ownerId,
          )
        : [];
    })()
      .then((data) => {
        if (active) setState({ data, isPending: false, error: null });
      })
      .catch((error: unknown) => {
        if (active)
          setState((current) => ({
            data: current.data,
            isPending: false,
            error:
              error instanceof Error
                ? error
                : new Error("Listing query failed"),
          }));
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  /** Applies a confirmed (or optimistic) status change without refetching. */
  const setFilled = useCallback(
    (listingId: string, isFilled: boolean) =>
      setState((current) => ({
        ...current,
        data: current.data?.map((listing) =>
          listing.id === listingId ? { ...listing, isFilled } : listing,
        ),
      })),
    [],
  );
  const refetch = useCallback(() => setAttempt((value) => value + 1), []);

  return {
    data: state.data,
    isPending: state.isPending,
    isError: state.error !== null,
    error: state.error,
    refetch,
    setFilled,
  };
}
