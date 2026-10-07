import { useListings } from "../../lib/supabase/hooks";
import { ListingCard } from "../../components/listing-card";
export const dynamic = "force-dynamic";
import Link from "next/link";

export default function ListingsPage() {
  const { data: listings, isLoading, error } = useListings();
  return (
    <div className="content-wrap">
      <header className="topbar">
        <div>
          <p className="eyebrow">Dobrodošel nazaj, Amar 👋</p>
          <h1>Oglasi za sobe</h1>
        </div>
        <Link className="icon-button" aria-label="Odpri klepete in obvestila" href="/chats">
          ♧<span className="notification-dot" />
        </Link>
      </header>
      <section className="hero-banner">
        <div>
          <span className="eyebrow">NOVO V ROOMIESLO</span>
          <h2>Najdi prostor, kjer se boš počutil doma.</h2>
          <p>Preverjeni študenti. Resnični oglasi. Boljši začetek.</p>
          <a className="button button-light" href="/search">
            Razišči oglase <span>→</span>
          </a>
        </div>
        <div className="hero-shape">⌂</div>
      </section>
      <div className="section-heading">
        <div>
          <h2>Priporočeni oglasi</h2>
          <p className="muted">Izbrano glede na tvoje preference</p>
        </div>
        <a className="text-link" href="/search">
          Poglej vse →
        </a>
      </div>
      {isLoading && <div className="page-state" aria-live="polite"><p>Nalaganje oglasov ...</p></div>}
      {error && <div className="page-state" role="alert"><h2>Oglasov ni mogoče naložiti</h2><p>Preveri povezavo in prijavo v Supabase.</p></div>}
      {!isLoading && !error && listings?.length === 0 && <div className="empty-state"><h2>Trenutno ni oglasov</h2><p>Ko bodo oglasi na voljo, se bodo prikazali tukaj.</p></div>}
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
      <div className="action-grid">
        <a href="/search" className="action-card">
          <span className="action-icon green">⌕</span>
          <span>
            <b>Iskanje sobe</b>
            <small>Nastavi svoje filtre</small>
          </span>
          <strong>→</strong>
        </a>
        <a href="/profile" className="action-card">
          <span className="action-icon amber">✦</span>
          <span>
            <b>Izpolni vprašalnik</b>
            <small>Izboljšaj ujemanja</small>
          </span>
          <strong>→</strong>
        </a>
      </div>
    </div>
  );
}
