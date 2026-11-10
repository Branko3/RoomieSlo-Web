import type { Formatters } from "../i18n/formatters";
import type { I18n } from "../i18n/i18n";
import type { Messages } from "../i18n/types";
import type { Listing } from "../supabase/mappers";
import { isRoomType, ROOM_TYPE_KEYS } from "./room-types";

type ListingsText = Messages["listings"];

/**
 * Label for a stored `room_type`. An empty value reads as a room (the
 * historical default); a value outside the list (free text written by an
 * older client) is shown as stored.
 */
export function roomTypeLabel(
  roomType: string | null | undefined,
  m: ListingsText,
): string {
  const value = roomType?.trim() ?? "";
  if (!value) return m.roomTypes.room;
  return isRoomType(value) ? m.roomTypes[ROOM_TYPE_KEYS[value]] : value;
}

/**
 * Move-in day: the calendar date without a time-zone shift, or "by
 * arrangement" when the owner left it empty.
 */
export function moveInLabel(
  availableFrom: string | null | undefined,
  m: ListingsText,
  formatters: Pick<Formatters, "calendarDate">,
): string {
  return availableFrom
    ? formatters.calendarDate(availableFrom)
    : m.moveInByAgreement;
}

/**
 * Short fact line for a listing card ("16 m² · 2 sostanovalca · stroški
 * vključeni"). Facts that are unknown, zero or false are left out; listings
 * cached before the facts were mapped simply show none.
 */
export function listingDetails(
  listing: Pick<Listing, "sizeSqm" | "flatmates" | "billsIncluded">,
  { m, format, plural }: Pick<I18n, "m" | "format" | "plural">,
): string {
  const text = m.listings.details;
  return [
    listing.sizeSqm == null
      ? null
      : format(text.size, { size: listing.sizeSqm }),
    listing.flatmates ? plural(text.flatmates, listing.flatmates) : null,
    listing.billsIncluded ? text.billsIncluded : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Ljubljana calendar day of a moment such as `created_at`, so a listing
 * posted at 00:30 local time is not shown as the previous (UTC) day.
 * Unparseable values are returned unchanged instead of throwing.
 */
export function timestampDate(
  timestamp: string,
  formatters: Pick<Formatters, "date">,
): string {
  return Number.isNaN(new Date(timestamp).getTime())
    ? timestamp
    : formatters.date(timestamp);
}
