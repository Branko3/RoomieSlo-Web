"use client";

import Link from "next/link";
import { FavoriteIconButton } from "./favorite-button";
import { MapPinIcon } from "./icons";
import { ListingPhoto } from "./listing-photo";
import { useI18n } from "../lib/i18n/provider";
import {
  listingDetails,
  moveInLabel,
  roomTypeLabel,
} from "../lib/listings/format";
import type { Listing } from "../lib/supabase/mappers";

/**
 * A listing as a notice-board flyer: photo, what and where, then a
 * perforated tear-off strip with the rent and the move-in date.
 * `ListingGridSkeleton` (components/data-states.tsx) mirrors this structure;
 * change both together so the grid does not jump when listings arrive.
 */
export function ListingCard({ listing }: { listing: Listing }) {
  const i18n = useI18n();
  const { m, formatters } = i18n;
  const details = listingDetails(listing, i18n);
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
          <span className="chip">
            {roomTypeLabel(listing.roomType, m.listings)}
          </span>
          {!listing.isFilled && (
            <span className="chip chip-green">
              {m.listings.status.available}
            </span>
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
        {details && <p className="listing-details">{details}</p>}
      </div>
      <dl className="tear-strip">
        <div>
          <dt>{m.listings.card.rent}</dt>
          <dd className="tear-price">
            {formatters.currency(listing.price)}{" "}
            <span>{m.listings.card.perMonth}</span>
          </dd>
        </div>
        <div>
          <dt>{m.listings.card.availableFrom}</dt>
          <dd>{moveInLabel(listing.availableFrom, m.listings, formatters)}</dd>
        </div>
      </dl>
    </article>
  );
}
