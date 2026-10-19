/** [route, icon key, label]; the icon key maps to an SVG in components/app-shell.tsx. */
export const NAV_ITEMS = [
  ["listings", "home", "Oglasi"],
  ["search", "search", "Iskanje"],
  ["chats", "chat", "Klepeti"],
  ["favorites", "heart", "Priljubljene"],
  ["profile", "user", "Profil"],
] as const;

export type NavIcon = (typeof NAV_ITEMS)[number][1];

/** The first path segment marks the active section; the root shows listings. */
export function activeSection(pathname: string | null): string {
  return pathname?.split("/")[1] || "listings";
}
