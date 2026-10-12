/** Placeholder shown when a listing has no usable photo (the existing preview art). */
export const PHOTO_PLACEHOLDER = "🏠";

/**
 * Returns the listing photo URL when it is safe to load in an <img>, else null.
 * `listings.photo_url` is free text written by owners (Android stores the
 * string as-is), so only absolute https URLs are accepted. `javascript:`,
 * `data:`, `http:`, protocol-relative, relative, and malformed values fall
 * back to the placeholder.
 */
export function safePhotoUrl(value: string | null | undefined): string | null {
  const candidate = value?.trim();
  if (!candidate || !/^https:\/\//i.test(candidate)) return null;
  try {
    const url = new URL(candidate);
    if (
      url.protocol !== "https:" ||
      !url.hostname ||
      url.username ||
      url.password
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

/** Accessible description for a listing photo. */
export function photoAlt(listing: { title: string; district: string }): string {
  const place =
    listing.district && listing.district !== listing.title
      ? `, ${listing.district}`
      : "";
  return `Fotografija oglasa: ${listing.title}${place}`;
}
