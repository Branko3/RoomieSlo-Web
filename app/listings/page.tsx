"use client";

import { CacheNotice } from "../../components/cache-notice";
import {
  DataState,
  EmptyState,
  LoadingState,
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
import { useOfflineListings } from "../../lib/listings/use-offline-listings";
import Link from "next/link";

const QUICK_ACTIONS = [
  {
    href: "/search",
    Icon: SearchIcon,
    title: "Iskanje sobe",
    hint: "Nastavi svoje filtre",
  },
  {
    href: "/profile",
    Icon: ClipboardIcon,
    title: "Izpolni vprašalnik",
    hint: "Izboljšaj ujemanja",
  },
  {
    href: "/recommendations",
    Icon: UsersIcon,
    title: "Priporočeni sostanovalci",
    hint: "Razvrščeni po združljivosti",
  },
] as const;

export default function ListingsPage() {
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
          <h1>Oglasi za sobe</h1>
        </div>
        <Link
          className="icon-button"
          aria-label="Odpri klepete in obvestila"
          href="/chats"
        >
          <BellIcon />
        </Link>
      </header>
      <section className="hero-banner" aria-labelledby="hero-title">
        <div>
          <h2 id="hero-title">Najdi prostor, kjer se boš počutil doma.</h2>
          <p>Preverjeni študenti. Resnični oglasi. Boljši začetek.</p>
          <Link className="button button-light" href="/search">
            Razišči oglase
          </Link>
        </div>
      </section>
      <div className="section-heading">
        <div>
          <h2>Priporočeni oglasi</h2>
          <p className="muted">Izbrano glede na tvoje preference</p>
        </div>
        <div className="section-actions">
          <Link className="button button-outline" href="/listings/new">
            <PlusIcon size={18} />
            Objavi oglas
          </Link>
          <Link className="text-link link-chevron" href="/search">
            Poglej vse
            <ChevronRightIcon size={16} />
          </Link>
        </div>
      </div>
      <CacheNotice view={view} onRetry={retry} />
      {isLoading && <LoadingState label="Nalaganje oglasov ..." />}
      {!isLoading && error && (
        <DataState error={error} onRetry={retry}>
          <span />
        </DataState>
      )}
      {!isLoading && !error && listings?.length === 0 && (
        <EmptyState
          title="Trenutno ni oglasov"
          description="Ko bodo oglasi na voljo, se bodo prikazali tukaj."
          action={
            <Link className="button" href="/search">
              Razišči oglase
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
          <h2>Hitra dejanja</h2>
          <p className="muted">Kaj želiš narediti danes?</p>
        </div>
      </div>
      <ul className="row-list">
        {QUICK_ACTIONS.map(({ href, Icon, title, hint }) => (
          <li key={href}>
            <Link href={href} className="row-link">
              <span className="row-icon">
                <Icon />
              </span>
              <span className="row-text">
                <b>{title}</b>
                <small>{hint}</small>
              </span>
              <ChevronRightIcon className="icon row-chevron" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
