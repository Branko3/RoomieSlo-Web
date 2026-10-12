import { test } from "@playwright/test";

/** Shared environment checks for the Playwright suite. */
export const supabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export const listingId = process.env.E2E_LISTING_ID ?? "";

export const NAV = [
  { route: "listings", label: "Oglasi", heading: "Oglasi za sobe" },
  { route: "search", label: "Iskanje", heading: "Iskanje sobe" },
  { route: "chats", label: "Klepeti", heading: "Ujemanja in klepeti" },
  { route: "favorites", label: "Priljubljene", heading: "Priljubljeni oglasi" },
  { route: "profile", label: "Profil", heading: "Profil" },
] as const;

export const FAVORITES_KEY = "roomieslo:favorites";

/**
 * App routes are guarded (middleware + AuthProvider): signed-out visitors go to /login and an
 * unconfigured build goes to /auth-error. Specs for guarded pages therefore need the
 * authenticated staging project.
 */
export function requireSignedIn(testInfo: { project: { name: string } }) {
  test.skip(
    !supabaseConfigured || testInfo.project.name !== "authenticated",
    "Guarded route: requires staging Supabase and the authenticated project.",
  );
}
