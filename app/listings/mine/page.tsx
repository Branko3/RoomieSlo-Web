"use client";

import Link from "next/link";
import {
  DataState,
  EmptyState,
  ListingGridSkeleton,
} from "../../../components/data-states";
import { ChevronLeftIcon, PlusIcon } from "../../../components/icons";
import { useI18n } from "../../../lib/i18n/provider";
import { OwnListingCard } from "../../../components/own-listing-card";
import { myListingsSummary } from "../../../lib/listings/my-listings";
import { useMyListings } from "../../../lib/listings/use-my-listings";

/**
 * "Moji oglasi": every listing the user posted, filled ones included, with
 * the owner's actions. The browsing feeds (/listings, /search) leave these out.
 */
export default function MyListingsPage() {
  const i18n = useI18n();
  const text = i18n.m.listings.mine;
  const {
    data: listings,
    isPending,
    error,
    refetch,
    setFilled,
  } = useMyListings();

  return (
    <div className="content-wrap">
      <Link className="back-link" href="/listings">
        <ChevronLeftIcon size={18} />
        {text.back}
      </Link>
      <header className="topbar">
        <div>
          <h1>{text.title}</h1>
          {listings && listings.length > 0 && (
            <p className="muted" aria-live="polite">
              {myListingsSummary(listings, i18n)}
            </p>
          )}
        </div>
        <Link className="button" href="/listings/new">
          <PlusIcon size={18} />
          {text.post}
        </Link>
      </header>
      {isPending ? (
        <ListingGridSkeleton label={text.loading} />
      ) : error ? (
        <DataState error={error} onRetry={() => void refetch()}>
          <span />
        </DataState>
      ) : !listings || listings.length === 0 ? (
        <EmptyState
          title={text.emptyTitle}
          description={text.emptyBody}
          action={
            <Link className="button" href="/listings/new">
              {text.post}
            </Link>
          }
        />
      ) : (
        <div className="listing-grid">
          {listings.map((listing) => (
            <OwnListingCard
              key={listing.id}
              listing={listing}
              onFilledChange={(filled) => setFilled(listing.id, filled)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
