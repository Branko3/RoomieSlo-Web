"use client";

import Link from "next/link";
import { MapPinIcon } from "./icons";
import { ListingPhoto } from "./listing-photo";
import { ListingStatusToggle } from "./listing-status-control";
import { useI18n } from "../lib/i18n/provider";
import { roomTypeLabel, timestampDate } from "../lib/listings/format";
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
  const { m, format, formatters } = useI18n();
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
          <span className="chip">
            {roomTypeLabel(listing.roomType, m.listings)}
          </span>
          <span
            className={`chip ${listing.isFilled ? "chip-filled" : "chip-available"}`}
            aria-live="polite"
          >
            {listing.isFilled
              ? m.listings.status.filled
              : m.listings.status.available}
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
          <dt>{m.listings.card.rent}</dt>
          <dd className="tear-price">
            {formatters.currency(listing.price)}{" "}
            <span>{m.listings.card.perMonth}</span>
          </dd>
        </div>
        <div>
          <dt>{m.listings.card.published}</dt>
          <dd>{timestampDate(listing.createdAt, formatters)}</dd>
        </div>
      </dl>
      <div className="own-listing-actions">
        <Link
          className="button button-outline"
          href={`/listings/${encodeURIComponent(listing.id)}/edit`}
          aria-label={format(m.listings.mine.editNamed, {
            title: listing.title,
          })}
        >
          {m.listings.mine.edit}
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
