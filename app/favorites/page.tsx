"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useListings } from "../../lib/supabase/hooks";
import { ListingPhoto } from "../../components/listing-photo";
import { useFavorites } from "../../components/providers";
import { FavoriteIconButton } from "../../components/favorite-button";
import { SparkleIcon } from "../../components/icons";
import { useI18n } from "../../lib/i18n/provider";
import {
  fetchFavoriteListings,
  type FavoritesClient,
} from "../../lib/favorites/favorites-api";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";
import {
  DataState,
  EmptyState,
  LoadingState,
} from "../../components/data-states";

export default function FavoritesPage() {
  const { m, format, formatters } = useI18n();
  const text = m.favorites;
  const { favorites, userId } = useFavorites();
  // Signed in: the user's favorites come straight from Supabase (one nested query).
  const remote = useQuery({
    queryKey: ["favorites", "listings", userId],
    enabled: Boolean(userId),
    queryFn: () =>
      fetchFavoriteListings(
        createSupabaseBrowserClient() as unknown as FavoritesClient,
        userId as string,
      ),
  });
  // Signed out (browser-only favorites): match against the listing feed as before.
  const local = useListings();
  const listings = userId ? (remote.data ?? []) : (local.data ?? []);
  const isLoading = userId ? remote.isPending : local.isLoading;
  const error = userId ? remote.error : local.error;
  const retry = () => (userId ? void remote.refetch() : local.retry());
  // Filtering by the live favorite ids makes removals disappear immediately.
  const favoriteListings = listings.filter((listing) =>
    favorites.includes(listing.id),
  );

  return (
    <div className="content-wrap">
      <header className="topbar">
        <div>
          <h1>{text.title}</h1>
        </div>
      </header>
      {isLoading ? (
        <LoadingState label={text.loading} />
      ) : error ? (
        <DataState error={error} onRetry={retry}>
          <span />
        </DataState>
      ) : favoriteListings.length > 0 ? (
        <div className="favorite-list">
          {favoriteListings.map((listing) => (
            <div className="favorite-row" key={listing.id}>
              <Link
                href={`/listings/${listing.id}`}
                className="favorite-row-link"
              >
                <span className="favorite-art">
                  <ListingPhoto listing={listing} sizes="65px" />
                </span>
                <span>
                  <b>{listing.title}</b>
                  <small>
                    {format(text.rowMeta, {
                      district: listing.district,
                      price: formatters.currency(listing.price),
                    })}
                  </small>
                </span>
              </Link>
              <FavoriteIconButton
                listingId={listing.id}
                subject={listing.title}
              />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title={text.emptyTitle}
          description={text.emptyBody}
          action={
            <Link className="button" href="/search">
              {text.explore}
            </Link>
          }
        />
      )}
      <div className="tip-card">
        <SparkleIcon />
        <div>
          <b>{text.tipTitle}</b>
          <p>{text.tipBody}</p>
        </div>
      </div>
    </div>
  );
}
