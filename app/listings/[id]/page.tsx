"use client";

import Link from "next/link";
import { useState } from "react";
import { MatchRequestButton } from "../../../components/match-request-button";
import { getSupabaseConfig } from "../../../lib/config";
import { ListingPhoto } from "../../../components/listing-photo";
import { ListingStatusControl } from "../../../components/listing-status-control";
import { DeleteListingButton } from "../../../components/delete-listing-button";
import { OwnerListingActions } from "../../../components/owner-listing-actions";
import { FavoriteTextButton } from "../../../components/favorite-button";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  FlagIcon,
  MapPinIcon,
} from "../../../components/icons";
import { listingReportHref } from "../../../lib/reports/report";
import { canRequestMatch } from "../../../lib/listings/listing-status";
import { moveInLabel, roomTypeLabel } from "../../../lib/listings/format";
import { useI18n } from "../../../lib/i18n/provider";
import { useListing } from "../../../lib/supabase/hooks";
import { DataState, LoadingState } from "../../../components/data-states";
import { ListingAbout } from "../../../components/listing-about";

/** Supabase-backed request: sending, sent and failed states live in the button. */
function LiveMatchRequest({
  ownerId,
  isFilled,
}: {
  ownerId: string;
  isFilled: boolean;
}) {
  const { m } = useI18n();
  return (
    <>
      <MatchRequestButton
        ownerId={ownerId}
        disabled={!canRequestMatch(isFilled)}
      />
      {isFilled && (
        <p className="field-hint" id="listing-filled-note">
          {m.listings.detail.filledNote}
        </p>
      )}
    </>
  );
}

/** Preview build without Supabase: the form only simulates a sent request. */
function PreviewMatchRequest({ isFilled }: { isFilled: boolean }) {
  const { m } = useI18n();
  const text = m.listings.detail;
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState("");
  if (sent) {
    return (
      <div className="success-message full-button" aria-live="polite">
        {text.requestSent}{" "}
        <Link className="link-chevron" href="/chats">
          {text.openChats}
          <ChevronRightIcon size={16} />
        </Link>
      </div>
    );
  }
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!canRequestMatch(isFilled)) return;
        setSent(true);
      }}
    >
      <label className="sr-only" htmlFor="request-message">
        {text.messageLabel}
      </label>
      <textarea
        id="request-message"
        className="request-message"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder={text.messagePlaceholder}
        rows={3}
      />
      <button
        className="button full-button"
        type="submit"
        disabled={!canRequestMatch(isFilled)}
        aria-describedby={isFilled ? "listing-filled-note" : undefined}
      >
        {text.sendRequest}
      </button>
      {isFilled && (
        <p className="field-hint" id="listing-filled-note">
          {text.filledNote}
        </p>
      )}
    </form>
  );
}

export default function ListingDetail({ params }: { params: { id: string } }) {
  const { id } = params;
  const { m, formatters } = useI18n();
  const text = m.listings.detail;
  const { data: listing, isLoading, error, retry } = useListing(id);
  const [filledOverride, setFilledOverride] = useState<boolean | null>(null);

  if (isLoading) return <LoadingState label={text.loading} />;
  if (error)
    return (
      <DataState error={error} onRetry={retry}>
        <span />
      </DataState>
    );
  if (!listing) {
    return (
      <div className="page-state">
        <h1>{text.goneTitle}</h1>
        <p>{text.goneBody}</p>
        <Link className="button" href="/listings">
          {text.toListings}
        </Link>
      </div>
    );
  }

  const isFilled = filledOverride ?? listing.isFilled;
  return (
    <div className="content-wrap">
      <Link className="back-link" href="/listings">
        <ChevronLeftIcon size={18} />
        {text.backToListings}
      </Link>
      <div className="detail-layout">
        <div className="detail-image">
          <ListingPhoto
            listing={listing}
            sizes="(max-width: 900px) 100vw, 55vw"
            priority
          />
        </div>
        <div className="detail-copy">
          <div className="chips">
            <span className="chip">
              {roomTypeLabel(listing.roomType, m.listings)}
            </span>
            <span
              className={`chip ${isFilled ? "chip-filled" : "chip-available"}`}
              aria-live="polite"
            >
              {isFilled
                ? m.listings.status.filled
                : m.listings.status.available}
            </span>
          </div>
          <ListingStatusControl
            listingId={listing.id}
            ownerId={listing.ownerId}
            isFilled={isFilled}
            onChange={setFilledOverride}
          />
          <h1>{listing.title}</h1>
          <p className="flyer-place">
            <MapPinIcon size={16} />
            {listing.district}
          </p>
          <dl className="tear-strip tear-strip-large">
            <div>
              <dt>{m.listings.card.rent}</dt>
              <dd className="tear-price">
                {formatters.currency(listing.price)}{" "}
                <span>{m.listings.card.perMonth}</span>
              </dd>
            </div>
            <div>
              <dt>{m.listings.card.moveIn}</dt>
              <dd>
                {moveInLabel(listing.availableFrom, m.listings, formatters)}
              </dd>
            </div>
          </dl>
          <OwnerListingActions
            listingId={listing.id}
            ownerId={listing.ownerId}
          />
          {getSupabaseConfig().configured ? (
            <LiveMatchRequest ownerId={listing.ownerId} isFilled={isFilled} />
          ) : (
            <PreviewMatchRequest isFilled={isFilled} />
          )}
          <FavoriteTextButton listingId={listing.id} />
          <DeleteListingButton
            listingId={listing.id}
            ownerId={listing.ownerId}
          />
        </div>
        <div className="detail-sections">
          <ListingAbout listing={listing} />
          <section className="detail-section" aria-labelledby="safety-title">
            <h2 id="safety-title">{text.safetyTitle}</h2>
            <p className="muted">{text.safetyBody}</p>
            <Link
              className="text-link report-link"
              href={listingReportHref(listing.ownerId, listing.id)}
            >
              <FlagIcon size={16} />
              {text.report}
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
