"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "./auth-provider";

const navItems = [
  ["listings", "⌂", "Oglasi"],
  ["search", "⌕", "Iskanje"],
  ["chats", "▢", "Klepeti"],
  ["favorites", "♡", "Priljubljene"],
  ["profile", "◉", "Profil"],
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, loading } = useAuth();
  const isPublic = pathname === "/login" || pathname === "/register";

  useEffect(() => {
    if (loading) return;
    if (isPublic && session) {
      router.replace("/listings");
    } else if (!isPublic && !session) {
      const query = window.location.search.slice(1);
      const destination = query ? `${pathname}?${query}` : pathname;
      router.replace(`/login?next=${encodeURIComponent(destination)}`);
    }
  }, [isPublic, loading, pathname, router, session]);

  if (isPublic) return <>{children}</>;
  if (loading || !session) {
    return (
      <main className="page-state" aria-live="polite">
        {loading ? "Preverjanje seje ..." : "Preusmerjanje na prijavo ..."}
      </main>
    );
  }

  const active = pathname.split("/")[1] || "listings";

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Preskoči na vsebino
      </a>
      <aside className="sidebar">
        <Link className="brand" href="/listings">
          <span className="brand-mark">R</span>
          <span>
            Roomie<span>Slo</span>
          </span>
        </Link>
        <p className="sidebar-caption">Tvoj dom. Tvoja ekipa.</p>
        <nav aria-label="Glavna navigacija">
          {navItems.map(([route, icon, label]) => (
            <Link
              className={`nav-link ${active === route ? "active" : ""}`}
              href={`/${route}`}
              key={route}
            >
              <span className="nav-icon">{icon}</span>
              {label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="mini-profile">
            <span className="avatar avatar-small">AH</span>
            <span>
              <b>Amar H.</b>
              <small>Preverjen študent</small>
            </span>
          </div>
          <Link href="/profile" aria-label="Nastavitve profila">
            ⚙
          </Link>
        </div>
      </aside>
      <main id="main-content" className="main-content">
        {children}
      </main>
      <nav className="mobile-nav" aria-label="Mobilna navigacija">
        {navItems.map(([route, icon, label]) => (
          <Link
            className={active === route ? "active" : ""}
            href={`/${route}`}
            key={route}
          >
            <span>{icon}</span>
            <small>{label}</small>
          </Link>
        ))}
      </nav>
    </div>
  );
}
