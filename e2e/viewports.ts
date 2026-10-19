/**
 * Viewport matrix for responsive workflow coverage. The widths sit on each side
 * of the breakpoints in `app/globals.css`: at 650px and below the sidebar is
 * replaced by the bottom navigation; up to 900px the sidebar narrows.
 */
export const BREAKPOINTS = { mobileMax: 650, tabletMax: 900 } as const;

export type ViewportCase = {
  name: "mobile" | "tablet" | "desktop";
  width: number;
  height: number;
  /** Which navigation is visible at this size. */
  nav: "mobile" | "sidebar";
};

export const VIEWPORTS: readonly ViewportCase[] = [
  { name: "mobile", width: 390, height: 844, nav: "mobile" },
  { name: "tablet", width: 820, height: 1180, nav: "sidebar" },
  { name: "desktop", width: 1440, height: 900, nav: "sidebar" },
];

/** Pages on `main` with their level-1 heading. */
export const PAGES = [
  { path: "/listings", heading: "Oglasi za sobe" },
  { path: "/search", heading: "Iskanje sobe" },
  { path: "/listings/mine", heading: "Moji oglasi" },
  { path: "/chats", heading: "Ujemanja in klepeti" },
  { path: "/favorites", heading: "Priljubljeni oglasi" },
  { path: "/profile", heading: "Profil" },
  { path: "/recommendations", heading: "Priporočeni profili" },
  {
    path: "/academic-verification",
    heading: "Preverjanje akademskega statusa",
  },
  { path: "/auth-error", heading: "Prijava ni na voljo" },
  { path: "/privacy", heading: "Tvoji podatki" },
  { path: "/login", heading: "Prijavi se v svoj račun" },
  { path: "/register", heading: "Ustvari svoj račun" },
  { path: "/ne-obstaja", heading: "Stran ne obstaja" },
] as const;

/** WCAG 2.2 AA target size (2.5.8). */
export const MIN_TARGET_PX = 24;
