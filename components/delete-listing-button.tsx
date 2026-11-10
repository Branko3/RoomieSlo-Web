"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getSupabaseConfig } from "../lib/config";
import { useI18n } from "../lib/i18n/provider";
import {
  deleteListing,
  ListingDeleteError,
  type DeleteErrorKind,
  type ListingDeleteClient,
} from "../lib/listings/listing-delete";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";
import { useFavorites } from "./providers";

/**
 * Owner-only "Izbriši oglas" with a confirmation step (Android AlertDialog
 * parity). Hiding it for other users is UI only; RLS is the boundary.
 */
export function DeleteListingButton({
  listingId,
  ownerId,
}: {
  listingId: string;
  ownerId: string;
}) {
  const router = useRouter();
  const { m } = useI18n();
  const text = m.listings.delete;
  const { isFavorite, toggleFavorite } = useFavorites();
  const [isOwner, setIsOwner] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // The kind, not the text, so the message follows a language switch.
  const [error, setError] = useState<DeleteErrorKind | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const openRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!getSupabaseConfig().configured) return;
    let active = true;
    createSupabaseBrowserClient()
      .auth.getUser()
      .then(({ data }) => {
        if (active) setIsOwner(Boolean(data.user && data.user.id === ownerId));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [ownerId]);

  useEffect(() => {
    if (confirming) cancelRef.current?.focus();
  }, [confirming]);

  if (!isOwner) return null;

  function close() {
    setConfirming(false);
    openRef.current?.focus();
  }

  async function confirmDelete() {
    if (deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteListing(
        createSupabaseBrowserClient() as unknown as ListingDeleteClient,
        listingId,
      );
      if (isFavorite(listingId)) toggleFavorite(listingId);
      router.replace("/listings");
      router.refresh();
    } catch (failure) {
      setError(
        failure instanceof ListingDeleteError ? failure.kind : "unknown",
      );
      setDeleting(false);
      setConfirming(false);
    }
  }

  return (
    <div className="delete-listing">
      {error && (
        <p className="error-message" role="alert">
          {text.errors[error]}
        </p>
      )}
      {confirming ? (
        <div
          className="confirm-panel"
          role="alertdialog"
          aria-modal="false"
          aria-labelledby="delete-listing-title"
          aria-describedby="delete-listing-text"
          onKeyDown={(event) => {
            if (event.key === "Escape" && !deleting) close();
          }}
        >
          <b id="delete-listing-title">{text.confirmTitle}</b>
          <p id="delete-listing-text">{text.confirmBody}</p>
          <div className="confirm-actions">
            <button
              ref={cancelRef}
              className="button button-outline"
              type="button"
              onClick={close}
              disabled={deleting}
            >
              {text.cancel}
            </button>
            <button
              className="button button-danger"
              type="button"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? text.deleting : text.confirm}
            </button>
          </div>
        </div>
      ) : (
        <button
          ref={openRef}
          className="text-link danger-link"
          type="button"
          onClick={() => {
            setError(null);
            setConfirming(true);
          }}
        >
          {text.open}
        </button>
      )}
    </div>
  );
}
