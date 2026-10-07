"use client";

import Link from "next/link";
import { useFavorites } from "./providers";
import type { Listing } from "../lib/supabase/mappers";

export function ListingCard({ listing }: { listing: Listing }) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const favorite = isFavorite(listing.id);
  return (
    <article className="listing-card">
      <div className="listing-art">
        <span>{listing.image}</span>
        <button
          className={`heart-button ${favorite ? "liked" : ""}`}
          onClick={() => toggleFavorite(listing.id)}
          aria-pressed={favorite}
          aria-label={
            favorite ? "Odstrani iz priljubljenih" : "Dodaj med priljubljene"
          }
        >
          {favorite ? "♥" : "♡"}
        </button>
      </div>
      <div className="listing-body">
        <div className="chips">
          <span className="chip">{listing.roomType}</span>
          {!listing.isFilled && <span className="chip chip-green">Na voljo</span>}
        </div>
        <Link href={`/listings/${listing.id}`} className="listing-title">
          {listing.title}
        </Link>
        <p className="muted">⌖ {listing.district}</p>
        <div className="listing-meta">
          <div>
            <small>Najemnina</small>
            <strong>
              {listing.price} € <em>/ mesec</em>
            </strong>
          </div>
          <div>
            <small>Na voljo od</small>
            <strong>{listing.available}</strong>
          </div>
        </div>
        <p className="listing-details">{listing.details}</p>
      </div>
    </article>
  );
}
