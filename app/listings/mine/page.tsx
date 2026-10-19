"use client";

import Link from "next/link";
import {
  DataState,
  EmptyState,
  ListingGridSkeleton,
} from "../../../components/data-states";
import { ChevronLeftIcon, PlusIcon } from "../../../components/icons";
import { OwnListingCard } from "../../../components/own-listing-card";
import { myListingsSummary } from "../../../lib/listings/my-listings";
import { useMyListings } from "../../../lib/listings/use-my-listings";

/**
 * "Moji oglasi": every listing the user posted, filled ones included, with
 * the owner's actions. The browsing feeds (/listings, /search) leave these out.
 */
export default function MyListingsPage() {
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
        Nazaj na oglase
      </Link>
      <header className="topbar">
        <div>
          <h1>Moji oglasi</h1>
          {listings && listings.length > 0 && (
            <p className="muted" aria-live="polite">
              {myListingsSummary(listings)}
            </p>
          )}
        </div>
        <Link className="button" href="/listings/new">
          <PlusIcon size={18} />
          Objavi oglas
        </Link>
      </header>
      {isPending ? (
        <ListingGridSkeleton label="Nalaganje tvojih oglasov ..." />
      ) : error ? (
        <DataState error={error} onRetry={() => void refetch()}>
          <span />
        </DataState>
      ) : listings.length === 0 ? (
        <EmptyState
          title="Še nimaš oglasov"
          description="Ko objaviš oglas, ga najdeš tukaj, tudi ko je že zapolnjen."
          action={
            <Link className="button" href="/listings/new">
              Objavi oglas
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
