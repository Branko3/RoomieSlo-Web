"use client";

import { CacheNotice } from "../../components/cache-notice";
import {
  DataState,
  EmptyState,
  ListingGridSkeleton,
} from "../../components/data-states";
import {
  BellIcon,
  ChevronRightIcon,
  ClipboardIcon,
  PlusIcon,
  SearchIcon,
  UsersIcon,
} from "../../components/icons";
import { ListingCard } from "../../components/listing-card";
import { MyListingsShortcut } from "../../components/my-listings-links";
import { useOfflineListings } from "../../lib/listings/use-offline-listings";
import { useI18n } from "../../lib/i18n/provider";
import Link from "next/link";

/** Text comes from `m.listings.feed.quick[key]`. */
const QUICK_ACTIONS = [
  { href: "/search", Icon: SearchIcon, key: "search" },
  { href: "/profile", Icon: ClipboardIcon, key: "questionnaire" },
  { href: "/recommendations", Icon: UsersIcon, key: "recommendations" },
] as const;

export default function ListingsPage() {
  const { m } = useI18n();
  const text = m.listings.feed;
  const {
    data: listings,
    isLoading,
    error,
    view,
    retry,
  } = useOfflineListings();
  return (
    <div className="content-wrap">
      <header className="topbar">
        <div>
          <h1>{text.title}</h1>
        </div>
        <Link className="icon-button" aria-label={text.openChats} href="/chats">
          <BellIcon />
        </Link>
      </header>
      <section className="hero-banner" aria-labelledby="hero-title">
        <div>
          <h2 id="hero-title">{text.heroTitle}</h2>
          <p>{text.heroBody}</p>
          <Link className="button button-light" href="/search">
            {text.explore}
          </Link>
        </div>
      </section>
      <MyListingsShortcut />
      <div className="section-heading">
        <div>
          <h2>{text.recommendedTitle}</h2>
          <p className="muted">{text.recommendedHint}</p>
        </div>
        <div className="section-actions">
          <Link className="button button-outline" href="/listings/new">
            <PlusIcon size={18} />
            {text.post}
          </Link>
          <Link className="text-link link-chevron" href="/search">
            {text.seeAll}
            <ChevronRightIcon size={16} />
          </Link>
        </div>
      </div>
      <CacheNotice view={view} onRetry={retry} />
      {isLoading && <ListingGridSkeleton />}
      {!isLoading && error && (
        <DataState error={error} onRetry={retry}>
          <span />
        </DataState>
      )}
      {!isLoading && !error && listings?.length === 0 && (
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
      <div className="listing-grid">
        {listings?.slice(0, 3).map((listing) => (
          <ListingCard listing={listing} key={listing.id} />
        ))}
      </div>
      <div className="section-heading section-heading-spaced">
        <div>
          <h2>{text.quickTitle}</h2>
          <p className="muted">{text.quickHint}</p>
        </div>
      </div>
      <ul className="row-list">
        {QUICK_ACTIONS.map(({ href, Icon, key }) => (
          <li key={href}>
            <Link href={href} className="row-link">
              <span className="row-icon">
                <Icon />
              </span>
              <span className="row-text">
                <b>{text.quick[key].title}</b>
                <small>{text.quick[key].hint}</small>
              </span>
              <ChevronRightIcon className="row-chevron" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
