"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchListing, fetchListings, type ListingQuery } from "./queries";
import type { Listing } from "./mappers";

export function useListings(query: ListingQuery = {}) {
  const [state, setState] = useState<{
    data?: Listing[];
    isLoading: boolean;
    error: Error | null;
  }>({ isLoading: true, error: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setState((current) => ({
      data: current.data,
      isLoading: true,
      error: null,
    }));
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
          setState((current) => ({
            data: current.data,
            isLoading: false,
            error:
              error instanceof Error
                ? error
                : new Error("Listing query failed"),
          }));
      });
    return () => {
      active = false;
    };
  }, [query.location, query.maxPrice, query.cursor, query.limit, attempt]);
  return {
    ...state,
    retry: useCallback(() => setAttempt((value) => value + 1), []),
  };
}

export function useListing(id: string) {
  const [state, setState] = useState<{
    data?: Listing | null;
    isLoading: boolean;
    error: Error | null;
  }>({ isLoading: Boolean(id), error: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!id) return;
    let active = true;
    setState((current) => ({
      data: current.data,
      isLoading: true,
      error: null,
    }));
    fetchListing(id)
      .then(
        (data) => active && setState({ data, isLoading: false, error: null }),
      )
      .catch((error: unknown) => {
        if (active)
          setState((current) => ({
            data: current.data,
            isLoading: false,
            error:
              error instanceof Error
                ? error
                : new Error("Listing query failed"),
          }));
      });
    return () => {
      active = false;
    };
  }, [id, attempt]);
  return {
    ...state,
    retry: useCallback(() => setAttempt((value) => value + 1), []),
  };
}
