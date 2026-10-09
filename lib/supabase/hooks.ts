"use client";

import { useEffect, useState } from "react";
import { fetchListing, fetchListings, type ListingQuery } from "./queries";
import type { Listing } from "./mappers";

export function useListings(query: ListingQuery = {}) {
  const [state, setState] = useState<{
    data?: Listing[];
    isLoading: boolean;
    error: Error | null;
  }>({ isLoading: true, error: null });
  useEffect(() => {
    let active = true;
    setState({ isLoading: true, error: null });
    fetchListings({
      location: query.location,
      maxPrice: query.maxPrice,
      cursor: query.cursor,
      limit: query.limit,
    })
      .then(
        (data) => active && setState({ data, isLoading: false, error: null }),
      )
      .catch((error: unknown) => {
        if (active)
          setState({
            isLoading: false,
            error:
              error instanceof Error
                ? error
                : new Error("Listing query failed"),
          });
      });
    return () => {
      active = false;
    };
  }, [query.location, query.maxPrice, query.cursor, query.limit]);
  return state;
}

export function useListing(id: string) {
  const [state, setState] = useState<{
    data?: Listing | null;
    isLoading: boolean;
    error: Error | null;
  }>({ isLoading: Boolean(id), error: null });
  useEffect(() => {
    if (!id) return;
    let active = true;
    setState({ isLoading: true, error: null });
    fetchListing(id)
      .then(
        (data) => active && setState({ data, isLoading: false, error: null }),
      )
      .catch((error: unknown) => {
        if (active)
          setState({
            isLoading: false,
            error:
              error instanceof Error
                ? error
                : new Error("Listing query failed"),
          });
      });
    return () => {
      active = false;
    };
  }, [id]);
  return state;
}
