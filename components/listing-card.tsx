"use client";

import Link from "next/link";
import { FavoriteIconButton } from "./favorite-button";
import { MapPinIcon } from "./icons";
import { ListingPhoto } from "./listing-photo";
import { formatMoveIn, formatPrice } from "../lib/listings/format";
import type { Listing } from "../lib/supabase/mappers";

/**
 * A listing as a notice-board flyer: photo, what and where, then a
 * perforated tear-off strip with the rent and the move-in date.
 * `ListingGridSkeleton` (components/data-states.tsx) mirrors this structure;
 * change both together so the grid does not jump when listings arrive.
 */
export function ListingCard({ listing }: { listing: Listing }) {
  return (
    <article className="listing-card flyer">
      <div className="listing-art">
        <ListingPhoto
          listing={listing}
          sizes="(max-width: 650px) 100vw, (max-width: 1100px) 50vw, 33vw"
        />
        <FavoriteIconButton listingId={listing.id} subject={listing.title} />
      </div>
      <div className="listing-body">
        <div className="chips">
          <span className="chip">{listing.roomType}</span>
          {!listing.isFilled && (
            <span className="chip chip-green">Na voljo</span>
          )}
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
        {listing.details && (
          <p className="listing-details">{listing.details}</p>
        )}
      </div>
      <dl className="tear-strip">
        <div>
          <dt>Najemnina</dt>
          <dd className="tear-price">
            {formatPrice(listing.price)} <span>/ mesec</span>
          </dd>
        </div>
        <div>
          <dt>Na voljo od</dt>
          <dd>{formatMoveIn(listing.available)}</dd>
        </div>
      </dl>
    </article>
  );
}
