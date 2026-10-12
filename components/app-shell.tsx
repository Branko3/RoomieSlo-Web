"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./auth-provider";
import { getRouteAccess } from "../lib/auth/routes";

const navItems = [
  ["listings", "⌂", "Oglasi"],
  ["search", "⌕", "Iskanje"],
  ["chats", "▢", "Klepeti"],
  ["favorites", "♡", "Priljubljene"],
  ["profile", "◉", "Profil"],
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { session, signOut } = useAuth();
  if (getRouteAccess(pathname) === "public") return <>{children}</>;
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
              <b>{session?.user.email ?? "Uporabnik"}</b>
              <small>Prijavljen</small>
            </span>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            aria-label="Odjava"
          >
            ↪
          </button>
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
