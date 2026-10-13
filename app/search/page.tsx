"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ListingCard } from "../../components/listing-card";
import { listingCountLabel } from "../../lib/listings/result-label";
import { useListingPages } from "../../lib/listings/use-listing-pages";
import { useCachedListingsFallback } from "../../lib/listings/use-offline-listings";
import { CacheNotice } from "../../components/cache-notice";
import {
  DataState,
  EmptyState,
  LoadingState,
  useOnlineStatus,
} from "../../components/data-states";

const OFFLINE_ERROR = new Error("Brez povezave");

export default function SearchPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [location, setLocation] = useState(params.get("location") ?? "");
  const [maxPrice, setMaxPrice] = useState(
    Number(params.get("maxPrice") ?? 600),
  );
  const [sort, setSort] = useState(params.get("sort") ?? "relevance");
  const {
    listings,
    isPending,
    isError,
    error: queryError,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useListingPages({ location, maxPrice });
  // A failed "load more" keeps the loaded results; only a failed first page is a page error.
  const firstPageError = isError && !isFetchNextPageError ? queryError : null;
  const retry = () => void refetch();
  // Offline or failed first page: show the signed-in user's cached listings (stale view).
  const online = useOnlineStatus();
  const fallback = useCachedListingsFallback(
    { location, maxPrice },
    firstPageError ? "error" : !online ? "offline" : null,
  );
  const cachedListings =
    fallback?.source === "cache" ? fallback.listings : null;
  // TanStack Query pauses while offline; without cached data show the offline state, not a spinner.
  const offlineWithoutData = !online && isPending && !cachedListings;
  const isLoading = isPending && !cachedListings && !offlineWithoutData;
  const error = cachedListings
    ? null
    : (firstPageError ?? (offlineWithoutData ? OFFLINE_ERROR : null));
  useEffect(() => {
    setLocation(params.get("location") ?? "");
    setMaxPrice(Number(params.get("maxPrice") ?? 600));
    setSort(params.get("sort") ?? "relevance");
  }, [params]);
  const updateUrl = (next: {
    location?: string;
    maxPrice?: number;
    sort?: string;
  }) => {
    const nextParams = new URLSearchParams(params.toString());
    if (next.location !== undefined) nextParams.set("location", next.location);
    if (next.maxPrice !== undefined)
      nextParams.set("maxPrice", String(next.maxPrice));
    if (next.sort !== undefined) nextParams.set("sort", next.sort);
    router.replace(`${pathname}?${nextParams.toString()}`);
  };
  const results = useMemo(() => {
    const filtered = (cachedListings ?? listings).filter(
      (listing) =>
        listing.price <= maxPrice &&
        listing.district.toLowerCase().includes(location.toLowerCase()),
    );
    return [...filtered].sort((a, b) =>
      sort === "price-asc"
        ? a.price - b.price
        : sort === "price-desc"
          ? b.price - a.price
          : sort === "newest"
            ? b.createdAt.localeCompare(a.createdAt)
            : 0,
    );
  }, [cachedListings, listings, location, maxPrice, sort]);
  const resultLabel = listingCountLabel(results.length);
  return (
    <div className="content-wrap">
      <header className="topbar">
        <div>
          <p className="eyebrow">RAZIŠČI</p>
          <h1>Iskanje sobe</h1>
        </div>
      </header>
      <section className="filter-panel">
        <div className="field">
          <label htmlFor="location">Lokacija</label>
          <input
            id="location"
            value={location}
            onChange={(event) => {
              setLocation(event.target.value);
              updateUrl({ location: event.target.value });
            }}
            placeholder="npr. Ljubljana"
          />
        </div>
        <div className="field range-field">
          <label htmlFor="price">
            Največji proračun <b>{maxPrice} €</b>
          </label>
          <input
            id="price"
            type="range"
            min="200"
            max="800"
            step="10"
            value={maxPrice}
            onChange={(event) => {
              const value = Number(event.target.value);
              setMaxPrice(value);
              updateUrl({ maxPrice: value });
            }}
          />
        </div>
        <button
          className="button"
          type="button"
          onClick={() => updateUrl({ location, maxPrice })}
        >
          Poišči oglase
        </button>
      </section>
      <div className="section-heading">
        <div>
          <h2 aria-live="polite">
            {results.length} {resultLabel} zate
          </h2>
          <p className="muted">Razvrščeno po združljivosti</p>
        </div>
        <label className="sort-control">
          Razvrsti:
          <select
            value={sort}
            onChange={(event) => {
              setSort(event.target.value);
              updateUrl({ sort: event.target.value });
            }}
          >
            <option value="relevance">Najbolj ustrezni</option>
            <option value="newest">Najnovejši</option>
            <option value="price-asc">Cena naraščajoče</option>
            <option value="price-desc">Cena padajoče</option>
          </select>
        </label>
      </div>
      {(location || maxPrice < 600) && (
        <div className="active-filters">
          {location && (
            <button
              onClick={() => {
                setLocation("");
                updateUrl({ location: "" });
              }}
            >
              {location} ×
            </button>
          )}
          {maxPrice < 600 && (
            <button
              onClick={() => {
                setMaxPrice(600);
                updateUrl({ maxPrice: 600 });
              }}
            >
              do {maxPrice} € ×
            </button>
          )}
          <button
            className="clear-filters"
            onClick={() => {
              setLocation("");
              setMaxPrice(600);
              setSort("relevance");
              router.replace(pathname);
            }}
          >
            Počisti filtre
          </button>
        </div>
      )}
      <CacheNotice view={cachedListings ? fallback : null} onRetry={retry} />
      <div className="listing-grid">
        {isLoading && <LoadingState label="Nalaganje oglasov ..." />}
        {!isLoading && error && (
          <DataState error={error} onRetry={retry}>
            <span />
          </DataState>
        )}
        {!isLoading &&
          !error &&
          results.map((listing) => (
            <ListingCard listing={listing} key={listing.id} />
          ))}
      </div>
      {!isLoading &&
        !error &&
        !cachedListings &&
        (hasNextPage || isFetchNextPageError) && (
          <div className="load-more">
            {isFetchNextPageError && (
              <p className="error-message" role="alert">
                Več oglasov ni bilo mogoče naložiti. Poskusi znova.
              </p>
            )}
            <button
              className="button button-outline"
              type="button"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              aria-busy={isFetchingNextPage || undefined}
            >
              {isFetchingNextPage ? "Nalaganje …" : "Naloži več oglasov"}
            </button>
          </div>
        )}
      {!isLoading &&
        !error &&
        results.length === 0 &&
        (cachedListings !== null || !hasNextPage) && (
          <EmptyState
            title="Ni zadetkov"
            description="Poskusi razširiti lokacijo ali povečati proračun."
          />
        )}
    </div>
  );
}
