"use client";

import Link from "next/link";
import { useListings } from "../../lib/supabase/hooks";
import { useFavorites } from "../../components/providers";
import {
  DataState,
  EmptyState,
  LoadingState,
} from "../../components/data-states";

export default function FavoritesPage() {
  const { favorites, toggleFavorite } = useFavorites();
  const { data: listings = [], isLoading, error, retry } = useListings();
  const favoriteListings = listings.filter((listing) =>
    favorites.includes(listing.id),
  );

  return (
    <div className="content-wrap">
      <header className="topbar">
        <div>
          <p className="eyebrow">TVOJA ZBIRKA</p>
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
                <span className="favorite-art">{listing.image}</span>
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
