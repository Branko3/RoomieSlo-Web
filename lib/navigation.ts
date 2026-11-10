/**
 * [route, icon key]; the icon key maps to an SVG in components/app-shell.tsx
 * and the label is `m.shell.nav[route]` in the active language.
 */
export const NAV_ITEMS = [
  ["listings", "home"],
  ["search", "search"],
  ["chats", "chat"],
  ["favorites", "heart"],
  ["profile", "user"],
] as const;

export type NavRoute = (typeof NAV_ITEMS)[number][0];
export type NavIcon = (typeof NAV_ITEMS)[number][1];

/** The first path segment marks the active section; the root shows listings. */
export function activeSection(pathname: string | null): string {
  return pathname?.split("/")[1] || "listings";
}
