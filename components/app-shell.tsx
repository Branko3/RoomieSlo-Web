"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./auth-provider";
import { useSession } from "./session-provider";
import { profileSummary } from "../lib/auth/session";
import { getRouteAccess, requiresSession } from "../lib/auth/routes";
import {
  activeSection,
  NAV_ITEMS as navItems,
  type NavIcon,
} from "../lib/navigation";
import {
  ChatIcon,
  HeartIcon,
  HomeIcon,
  LogOutIcon,
  SearchIcon,
  UserIcon,
} from "./icons";

const NAV_ICONS: Record<NavIcon, typeof HomeIcon> = {
  home: HomeIcon,
  search: SearchIcon,
  chat: ChatIcon,
  heart: HeartIcon,
  user: UserIcon,
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuth();
  const profile = profileSummary(useSession());
  if (!requiresSession(getRouteAccess(pathname))) return <>{children}</>;
  const active = activeSection(pathname);
  // A conversation is a focused task: on phones the composer replaces the bottom bar.
  const focused = /^\/chats\/[^/]+$/.test(pathname ?? "");

  return (
    <div className={`app-shell${focused ? " is-focused" : ""}`}>
      <a className="skip-link" href="#main-content">
        Preskoči na vsebino
      </a>
      <aside className="sidebar">
        <Link className="brand" href="/listings" translate="no">
          <span className="brand-mark" aria-hidden="true">
            R
          </span>
          <span>
            Roomie<span>Slo</span>
          </span>
        </Link>
        <p className="sidebar-caption">Tvoj dom. Tvoja ekipa.</p>
        <nav aria-label="Glavna navigacija">
          {navItems.map(([route, icon, label]) => {
            const Icon = NAV_ICONS[icon];
            return (
              <Link
                className={`nav-link ${active === route ? "active" : ""}`}
                href={`/${route}`}
                key={route}
                aria-current={active === route ? "page" : undefined}
              >
                <Icon size={22} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="mini-profile" aria-live="polite">
            {profile.kind === "signed-in" ? (
              <>
                <span className="avatar avatar-small" aria-hidden="true">
                  {profile.initials}
                </span>
                <span>
                  <b>{profile.name}</b>
                  <small>Prijavljen</small>
                </span>
              </>
            ) : (
              <span role="status">
                <small>Obnavljanje seje …</small>
              </span>
            )}
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={async () => {
              const result = await signOut();
              if (result.ok) router.replace(result.redirectTo);
            }}
            aria-label="Odjava"
          >
            <LogOutIcon />
          </button>
        </div>
      </aside>
      <main id="main-content" className="main-content">
        {children}
      </main>
      <nav className="mobile-nav" aria-label="Mobilna navigacija">
        {navItems.map(([route, icon, label]) => {
          const Icon = NAV_ICONS[icon];
          return (
            <Link
              className={active === route ? "active" : ""}
              href={`/${route}`}
              key={route}
              aria-current={active === route ? "page" : undefined}
            >
              <Icon size={24} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
