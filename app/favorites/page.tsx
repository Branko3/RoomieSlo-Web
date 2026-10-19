"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useListings } from "../../lib/supabase/hooks";
import { ListingPhoto } from "../../components/listing-photo";
import { useFavorites } from "../../components/providers";
import {
  fetchFavoriteListings,
  type FavoritesClient,
} from "../../lib/favorites/favorites-api";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";
import {
  DataState,
  EmptyState,
  LoadingState,
} from "../../components/data-states";

export default function FavoritesPage() {
  const { favorites, toggleFavorite, userId } = useFavorites();
  // Signed in: the user's favorites come straight from Supabase (one nested query).
  const remote = useQuery({
    queryKey: ["favorites", "listings", userId],
    enabled: Boolean(userId),
    queryFn: () =>
      fetchFavoriteListings(
        createSupabaseBrowserClient() as unknown as FavoritesClient,
        userId as string,
      ),
  });
  // Signed out (browser-only favorites): match against the listing feed as before.
  const local = useListings();
  const listings = userId ? (remote.data ?? []) : (local.data ?? []);
  const isLoading = userId ? remote.isPending : local.isLoading;
  const error = userId ? remote.error : local.error;
  const retry = () => (userId ? void remote.refetch() : local.retry());
  // Filtering by the live favorite ids makes removals disappear immediately.
  const favoriteListings = listings.filter((listing) =>
    favorites.includes(listing.id),
  );

  return (
    <div className="content-wrap">
      <header className="topbar">
        <div>
          <h1>Priljubljeni oglasi</h1>
        </div>
      </header>
      {isLoading ? (
        <LoadingState label="Nalaganje priljubljenih oglasov ..." />
      ) : error ? (
        <DataState error={error} onRetry={retry}>
          <span />
        </DataState>
      ) : favoriteListings.length > 0 ? (
        <div className="favorite-list">
          {favoriteListings.map((listing) => (
            <div className="favorite-row" key={listing.id}>
              <Link
                href={`/listings/${listing.id}`}
                className="favorite-row-link"
              >
                <span className="favorite-art">
                  <ListingPhoto listing={listing} sizes="65px" />
                </span>
                <span>
                  <b>{listing.title}</b>
                  <small>
                    {listing.district} · {listing.price} € / mesec
                  </small>
                </span>
              </Link>
              <button
                className="heart-button liked"
                onClick={() => toggleFavorite(listing.id)}
                aria-label={`Odstrani ${listing.title} iz priljubljenih`}
                aria-pressed="true"
              >
                ♥
              </button>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Še nimaš shranjenih oglasov"
          description="Ko najdeš zanimiv oglas, ga shrani za pozneje."
          action={
            <Link className="button" href="/search">
              Razišči oglase
            </Link>
          }
        />
      )}
      <div className="tip-card">
        <span>✦</span>
        <div>
          <b>Majhen nasvet</b>
          <p>Shranite oglase, ki so vam všeč, in jih primerjajte pozneje.</p>
        </div>
      </div>
    </div>
  );
}
