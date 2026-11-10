"use client";

import { useI18n } from "../lib/i18n/provider";
import { HeartIcon } from "./icons";
import { useFavorites } from "./providers";

/** Saved state and toggle for one listing, from the shared favorites store. */
export function useFavoriteToggle(listingId: string) {
  const { isFavorite, toggleFavorite } = useFavorites();
  return {
    saved: isFavorite(listingId),
    toggle: () => toggleFavorite(listingId),
  };
}

/**
 * Round heart over a photo or at the end of a row. The name says what the
 * press will do; `subject` names the listing when the button sits in a list
 * of several ("Odstrani Soba v centru iz priljubljenih").
 */
export function FavoriteIconButton({
  listingId,
  subject,
}: {
  listingId: string;
  subject?: string;
}) {
  const { m, format } = useI18n();
  const { saved, toggle } = useFavoriteToggle(listingId);
  const text = m.favorites;
  const label = subject
    ? format(saved ? text.removeNamed : text.addNamed, { subject })
    : saved
      ? text.remove
      : text.add;
  return (
    <button
      type="button"
      className={`heart-button ${saved ? "liked" : ""}`}
      onClick={toggle}
      aria-pressed={saved}
      aria-label={label}
    >
      <HeartIcon filled={saved} />
    </button>
  );
}

/** Full-width labelled save button for the listing detail page. */
export function FavoriteTextButton({ listingId }: { listingId: string }) {
  const { m } = useI18n();
  const { saved, toggle } = useFavoriteToggle(listingId);
  return (
    <button
      type="button"
      className={`button button-outline full-button favorite-text ${saved ? "liked" : ""}`}
      onClick={toggle}
      aria-pressed={saved}
    >
      <HeartIcon filled={saved} />
      {saved ? m.favorites.remove : m.favorites.save}
    </button>
  );
}
