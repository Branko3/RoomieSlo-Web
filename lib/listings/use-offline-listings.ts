"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../supabase/browser";
import { fetchListings, type ListingQuery } from "../supabase/queries";
import { getListingCacheStore } from "./indexeddb-store";
import {
  loadListingsWithFallback,
  type ListingsView,
} from "./offline-listings";

async function readSessionUserId(): Promise<string | null> {
  const { data } = await createSupabaseBrowserClient().auth.getSession();
  return data.session?.user.id ?? null;
}

/**
 * `useListings` with an offline/stale fallback to the browser cache. It
 * reloads automatically when the browser comes back online.
 */
export function useOfflineListings(query: ListingQuery = {}) {
  const [state, setState] = useState<{
    view: ListingsView | null;
    isLoading: boolean;
  }>({
    view: null,
    isLoading: true,
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const retry = () => setAttempt((value) => value + 1);
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, []);

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, isLoading: true }));
    loadListingsWithFallback({
      fetchFresh: () =>
        fetchListings({
          location: query.location,
          maxPrice: query.maxPrice,
          cursor: query.cursor,
          limit: query.limit,
        }),
      readUserId: readSessionUserId,
      store: getListingCacheStore(),
      query: {
        location: query.location,
        maxPrice: query.maxPrice,
        limit: query.limit,
      },
      isOnline: typeof navigator === "undefined" ? true : navigator.onLine,
    }).then((view) => {
      if (active) setState({ view, isLoading: false });
    });
    return () => {
      active = false;
    };
  }, [query.location, query.maxPrice, query.cursor, query.limit, attempt]);

  const view = state.view;
  return {
    view,
    isLoading: state.isLoading && !view,
    data: view && view.source !== "error" ? view.listings : undefined,
    error: view?.source === "error" ? view.error : null,
    retry: () => setAttempt((value) => value + 1),
  };
}

/**
 * Cache fallback for feeds that fetch through TanStack Query (the paged /search feed). When the
 * first page fails, or the browser is offline (TanStack Query pauses fetching), it loads the
 * signed-in user's cached listings for the same filters; otherwise it returns null.
 */
export function useCachedListingsFallback(
  query: { location?: string; maxPrice?: number },
  reason: "error" | "offline" | null,
): ListingsView | null {
  const [view, setView] = useState<ListingsView | null>(null);

  useEffect(() => {
    if (!reason) {
      setView(null);
      return;
    }
    let active = true;
    loadListingsWithFallback({
      fetchFresh: () => Promise.reject(new Error("Listing query failed")),
      readUserId: readSessionUserId,
      store: getListingCacheStore(),
      query: { location: query.location, maxPrice: query.maxPrice },
      isOnline: reason !== "offline",
    }).then((next) => {
      if (active) setView(next);
    });
    return () => {
      active = false;
    };
  }, [reason, query.location, query.maxPrice]);

  return view;
}
