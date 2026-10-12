export const NAV_ITEMS = [
  ["listings", "⌂", "Oglasi"],
  ["search", "⌕", "Iskanje"],
  ["chats", "▢", "Klepeti"],
  ["favorites", "♡", "Priljubljene"],
  ["profile", "◉", "Profil"],
] as const;

/** The first path segment marks the active section; the root shows listings. */
export function activeSection(pathname: string | null): string {
  return pathname?.split("/")[1] || "listings";
}
