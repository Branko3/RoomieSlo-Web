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
