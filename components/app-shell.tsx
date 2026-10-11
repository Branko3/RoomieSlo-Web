"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { profileSummary } from "../lib/auth/session";
import { useSession } from "./session-provider";

const navItems = [
  ["listings", "⌂", "Oglasi"],
  ["search", "⌕", "Iskanje"],
  ["chats", "▢", "Klepeti"],
  ["favorites", "♡", "Priljubljene"],
  ["profile", "◉", "Profil"],
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname.split("/")[1] || "listings";
  const profile = profileSummary(useSession());

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
          <div className="mini-profile" aria-live="polite">
            {profile.kind === "loading" && (
              <span role="status">
                <small>Obnavljanje seje …</small>
              </span>
            )}
            {profile.kind === "signed-in" && (
              <>
                <span className="avatar avatar-small">{profile.initials}</span>
                <span>
                  <b>{profile.name}</b>
                  <small>Prijavljen</small>
                </span>
              </>
            )}
            {profile.kind === "signed-out" && (
              <span>
                {profile.error && <small role="alert">{profile.error}</small>}
                <Link href="/login">Prijava</Link>
              </span>
            )}
            {profile.kind === "preview" && (
              <>
                <span className="avatar avatar-small">AH</span>
                <span>
                  <b>Amar H.</b>
                  <small>Preverjen študent</small>
                </span>
              </>
            )}
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
