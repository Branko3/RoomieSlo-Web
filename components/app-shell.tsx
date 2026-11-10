"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./auth-provider";
import { useSession } from "./session-provider";
import { profileSummary } from "../lib/auth/session";
import { getRouteAccess, requiresSession } from "../lib/auth/routes";
import { useI18n } from "../lib/i18n/provider";
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
import { LanguageSwitcher } from "./language-switcher";

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
  const { m } = useI18n();
  const profile = profileSummary(useSession(), m.auth.session.fallbackName);
  if (!requiresSession(getRouteAccess(pathname))) return <>{children}</>;
  const active = activeSection(pathname);
  // A conversation is a focused task: on phones the composer replaces the bottom bar.
  const focused = /^\/chats\/[^/]+$/.test(pathname ?? "");

  return (
    <div className={`app-shell${focused ? " is-focused" : ""}`}>
      <a className="skip-link" href="#main-content">
        {m.shell.skipToContent}
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
        <p className="sidebar-caption">{m.shell.tagline}</p>
        <nav aria-label={m.shell.mainNavigation}>
          {navItems.map(([route, icon]) => {
            const Icon = NAV_ICONS[icon];
            return (
              <Link
                className={`nav-link ${active === route ? "active" : ""}`}
                href={`/${route}`}
                key={route}
                aria-current={active === route ? "page" : undefined}
              >
                <Icon size={22} />
                {m.shell.nav[route]}
              </Link>
            );
          })}
        </nav>
        <LanguageSwitcher className="sidebar-language" />
        <div className="sidebar-bottom">
          <div className="mini-profile" aria-live="polite">
            {profile.kind === "signed-in" ? (
              <>
                <span className="avatar avatar-small" aria-hidden="true">
                  {profile.initials}
                </span>
                <span>
                  <b>{profile.name}</b>
                  <small>{m.shell.signedIn}</small>
                </span>
              </>
            ) : (
              <span role="status">
                <small>{m.shell.restoringSession}</small>
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
            aria-label={m.shell.signOut}
          >
            <LogOutIcon />
          </button>
        </div>
      </aside>
      <main id="main-content" className="main-content">
        {children}
      </main>
      <nav className="mobile-nav" aria-label={m.shell.mobileNavigation}>
        {navItems.map(([route, icon]) => {
          const Icon = NAV_ICONS[icon];
          return (
            <Link
              className={active === route ? "active" : ""}
              href={`/${route}`}
              key={route}
              aria-current={active === route ? "page" : undefined}
            >
              <Icon size={24} />
              <span>{m.shell.nav[route]}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
