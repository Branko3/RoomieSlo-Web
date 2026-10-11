"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useListings } from "../../lib/supabase/hooks";
import { useFavorites } from "../../components/providers";
import {
  fetchFavoriteListings,
  type FavoritesClient,
} from "../../lib/favorites/favorites-api";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";

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
  // Filtering by the live favorite ids makes removals disappear immediately.
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
        <div className="page-state">
          <p>Nalaganje priljubljenih oglasov ...</p>
        </div>
      ) : error ? (
        <div className="page-state" role="alert">
          <h2>Priljubljenih oglasov ni mogoče naložiti</h2>
          <p>Preveri povezavo in prijavo v Supabase.</p>
        </div>
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
        <div className="empty-state">
          <span>♡</span>
          <h2>Še nimaš shranjenih oglasov</h2>
          <p>Ko najdeš zanimiv oglas, ga shrani za pozneje.</p>
          <Link className="button" href="/search">
            Razišči oglase
          </Link>
        </div>
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
