"use client";

import Link from "next/link";
import { useState } from "react";
import { MatchRequestButton } from "../../../components/match-request-button";
import { getSupabaseConfig } from "../../../lib/config";
import { ListingPhoto } from "../../../components/listing-photo";
import { ListingStatusControl } from "../../../components/listing-status-control";
import { DeleteListingButton } from "../../../components/delete-listing-button";
import { OwnerListingActions } from "../../../components/owner-listing-actions";
import { useFavorites } from "../../../components/providers";
import { listingReportHref } from "../../../lib/reports/report";
import {
  canRequestMatch,
  listingStatusLabel,
} from "../../../lib/listings/listing-status";
import { useListing } from "../../../lib/supabase/hooks";
import { DataState, LoadingState } from "../../../components/data-states";

export default function ListingDetail({ params }: { params: { id: string } }) {
  const { id } = params;
  const { data: listing, isLoading, error, retry } = useListing(id);
  const { isFavorite, toggleFavorite } = useFavorites();
  const [requestState, setRequestState] = useState<"idle" | "success">("idle");
  const [message, setMessage] = useState("");
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

  const favorite = isFavorite(listing.id);
  const isFilled = filledOverride ?? listing.isFilled;
  return (
    <div className="content-wrap">
      <Link className="back-link" href="/listings">
        ← Nazaj na oglase
      </Link>
      <div className="detail-layout">
        <div className="detail-image">
          <ListingPhoto
            listing={listing}
            sizes="(max-width: 900px) 100vw, 50vw"
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
          <p className="muted">⌖ {listing.district}</p>
          <div className="price-large">
            {listing.price} € <small>/ mesec</small>
          </div>
          <OwnerListingActions
            listingId={listing.id}
            ownerId={listing.ownerId}
          />
          <p className="detail-description">
            {listing.description?.trim() || "Lastnik še ni dodal opisa."}
          </p>
          <dl className="detail-stats">
            {listing.sizeSqm != null && (
              <div>
                <dt>velikost</dt>
                <dd>{listing.sizeSqm} m²</dd>
              </div>
            )}
            <div>
              <dt>vselitev</dt>
              <dd>{listing.available}</dd>
            </div>
            {listing.deposit != null && (
              <div>
                <dt>varščina</dt>
                <dd>{listing.deposit} €</dd>
              </div>
            )}
          </dl>
          {getSupabaseConfig().configured ? (
            <>
              <MatchRequestButton
                ownerId={listing.ownerId}
                disabled={!canRequestMatch(isFilled)}
              />
              {isFilled && (
                <p className="field-hint" id="listing-filled-note">
                  Oglas je zapolnjen, zato zahteve za ujemanje niso mogoče.
                </p>
              )}
            </>
          ) : requestState === "success" ? (
            <div className="success-message full-button" aria-live="polite">
              Zahteva je poslana. <Link href="/chats">Odpri klepete →</Link>
            </div>
          ) : (
            <>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!canRequestMatch(isFilled)) return;
                  setRequestState("success");
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
                  aria-describedby={
                    isFilled ? "listing-filled-note" : undefined
                  }
                >
                  Pošlji zahtevo za ujemanje
                </button>
                {isFilled && (
                  <p className="field-hint" id="listing-filled-note">
                    Oglas je zapolnjen, zato zahteve za ujemanje niso mogoče.
                  </p>
                )}
              </form>
            </>
          )}
          <button
            className="button button-outline full-button"
            onClick={() => toggleFavorite(listing.id)}
            aria-pressed={favorite}
          >
            {favorite ? "♥ Odstrani iz priljubljenih" : "♡ Shrani oglas"}
          </button>
          <Link
            className="text-link report-link"
            href={listingReportHref(listing.ownerId, listing.id)}
          >
            Prijavi oglas
          </Link>
          <DeleteListingButton
            listingId={listing.id}
            ownerId={listing.ownerId}
          />
        </div>
      </div>
    </div>
  );
}
