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
import {
  canRequestMatch,
  listingStatusLabel,
} from "../../../lib/listings/listing-status";
import { formatMoveIn, formatPrice } from "../../../lib/listings/format";
import { useListing } from "../../../lib/supabase/hooks";
import { DataState, LoadingState } from "../../../components/data-states";
import { ListingAbout } from "../../../components/listing-about";

const FILLED_NOTE = "Oglas je zapolnjen, zato zahteve za ujemanje niso mogoče.";

/** Supabase-backed request: sending, sent and failed states live in the button. */
function LiveMatchRequest({
  ownerId,
  isFilled,
}: {
  ownerId: string;
  isFilled: boolean;
}) {
  return (
    <>
      <MatchRequestButton
        ownerId={ownerId}
        disabled={!canRequestMatch(isFilled)}
      />
      {isFilled && (
        <p className="field-hint" id="listing-filled-note">
          {FILLED_NOTE}
        </p>
      )}
    </>
  );
}

/** Preview build without Supabase: the form only simulates a sent request. */
function PreviewMatchRequest({ isFilled }: { isFilled: boolean }) {
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState("");
  if (sent) {
    return (
      <div className="success-message full-button" aria-live="polite">
        Zahteva je poslana.{" "}
        <Link className="link-chevron" href="/chats">
          Odpri klepete
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
        Sporočilo lastniku (neobvezno)
      </label>
      <textarea
        id="request-message"
        className="request-message"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="Dodaj kratko sporočilo (neobvezno)"
        rows={3}
      />
      <button
        className="button full-button"
        type="submit"
        disabled={!canRequestMatch(isFilled)}
        aria-describedby={isFilled ? "listing-filled-note" : undefined}
      >
        Pošlji zahtevo za ujemanje
      </button>
      {isFilled && (
        <p className="field-hint" id="listing-filled-note">
          {FILLED_NOTE}
        </p>
      )}
    </form>
  );
}

export default function ListingDetail({ params }: { params: { id: string } }) {
  const { id } = params;
  const { data: listing, isLoading, error, retry } = useListing(id);
  const [filledOverride, setFilledOverride] = useState<boolean | null>(null);

  if (isLoading) return <LoadingState label="Nalaganje oglasa ..." />;
  if (error)
    return (
      <DataState error={error} onRetry={retry}>
        <span />
      </DataState>
    );
  if (!listing) {
    return (
      <div className="page-state">
        <h1>Oglas ni več na voljo</h1>
        <p>Ta oglas ne obstaja ali je bil odstranjen.</p>
        <Link className="button" href="/listings">
          Na oglase
        </Link>
      </div>
    );
  }

  const isFilled = filledOverride ?? listing.isFilled;
  return (
    <div className="content-wrap">
      <Link className="back-link" href="/listings">
        <ChevronLeftIcon size={18} />
        Nazaj na oglase
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
            <span className="chip">{listing.roomType}</span>
            <span
              className={`chip ${isFilled ? "chip-filled" : "chip-available"}`}
              aria-live="polite"
            >
              {listingStatusLabel(isFilled)}
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
              <dt>Najemnina</dt>
              <dd className="tear-price">
                {formatPrice(listing.price)} <span>/ mesec</span>
              </dd>
            </div>
            <div>
              <dt>Vselitev</dt>
              <dd>{formatMoveIn(listing.available)}</dd>
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
            <h2 id="safety-title">Varnost</h2>
            <p className="muted">
              Stanovanje si pred plačilom oglej v živo in varščine ne nakazuj
              vnaprej.
            </p>
            <Link
              className="text-link report-link"
              href={listingReportHref(listing.ownerId, listing.id)}
            >
              <FlagIcon size={16} />
              Prijavi oglas
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
