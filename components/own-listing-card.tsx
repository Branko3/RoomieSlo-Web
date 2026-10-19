"use client";

import Link from "next/link";
import { MapPinIcon } from "./icons";
import { ListingPhoto } from "./listing-photo";
import { ListingStatusToggle } from "./listing-status-control";
import { formatMoveIn, formatPrice } from "../lib/listings/format";
import { listingStatusLabel } from "../lib/listings/listing-status";
import type { Listing } from "../lib/supabase/mappers";

/**
 * The user's own listing on "Moji oglasi": the same flyer as the browsing
 * card, but with its status and the owner's actions instead of a heart.
 * A separate component rather than an `isOwner` flag on `ListingCard`.
 */
export function OwnListingCard({
  listing,
  onFilledChange,
}: {
  listing: Listing;
  onFilledChange: (filled: boolean) => void;
}) {
  return (
    <article className="listing-card flyer own-listing">
      <div className="listing-art">
        <ListingPhoto
          listing={listing}
          sizes="(max-width: 650px) 100vw, (max-width: 1100px) 50vw, 33vw"
        />
      </div>
      <div className="listing-body">
        <div className="chips">
          <span className="chip">{listing.roomType}</span>
          <span
            className={`chip ${listing.isFilled ? "chip-filled" : "chip-available"}`}
            aria-live="polite"
          >
            {listingStatusLabel(listing.isFilled)}
          </span>
        </div>
        <h3 className="flyer-heading">
          <Link href={`/listings/${listing.id}`} className="listing-title">
            {listing.title}
          </Link>
        </h3>
        <p className="flyer-place">
          <MapPinIcon size={16} />
          {listing.district}
        </p>
      </div>
      <dl className="tear-strip">
        <div>
          <dt>Najemnina</dt>
          <dd className="tear-price">
            {formatPrice(listing.price)} <span>/ mesec</span>
          </dd>
        </div>
        <div>
          <dt>Objavljeno</dt>
          <dd>{formatMoveIn(listing.createdAt)}</dd>
        </div>
      </dl>
      <div className="own-listing-actions">
        <Link
          className="button button-outline"
          href={`/listings/${encodeURIComponent(listing.id)}/edit`}
          aria-label={`Uredi oglas ${listing.title}`}
        >
          Uredi
        </Link>
        <ListingStatusToggle
          listingId={listing.id}
          isFilled={listing.isFilled}
          onChange={onFilledChange}
        />
      </div>
    </article>
  );
}
