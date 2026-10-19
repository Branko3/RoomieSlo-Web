"use client";

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
  const { saved, toggle } = useFavoriteToggle(listingId);
  const what = subject ? ` ${subject}` : "";
  return (
    <button
      type="button"
      className={`heart-button ${saved ? "liked" : ""}`}
      onClick={toggle}
      aria-pressed={saved}
      aria-label={
        saved
          ? `Odstrani${what} iz priljubljenih`
          : `Dodaj${what} med priljubljene`
      }
    >
      <HeartIcon filled={saved} />
    </button>
  );
}

/** Full-width labelled save button for the listing detail page. */
export function FavoriteTextButton({ listingId }: { listingId: string }) {
  const { saved, toggle } = useFavoriteToggle(listingId);
  return (
    <button
      type="button"
      className={`button button-outline full-button favorite-text ${saved ? "liked" : ""}`}
      onClick={toggle}
      aria-pressed={saved}
    >
      <HeartIcon filled={saved} />
      {saved ? "Odstrani iz priljubljenih" : "Shrani oglas"}
    </button>
  );
}
