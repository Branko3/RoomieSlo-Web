"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getSupabaseConfig } from "../lib/config";
import {
  deleteErrorMessages,
  deleteListing,
  ListingDeleteError,
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
  const { isFavorite, toggleFavorite } = useFavorites();
  const [isOwner, setIsOwner] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
        failure instanceof ListingDeleteError
          ? failure.message
          : deleteErrorMessages.unknown,
      );
      setDeleting(false);
      setConfirming(false);
    }
  }

  return (
    <div className="delete-listing">
      {error && (
        <p className="error-message" role="alert">
          {error}
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
          <b id="delete-listing-title">Izbriši oglas?</b>
          <p id="delete-listing-text">Oglasa ne bo več mogoče obnoviti.</p>
          <div className="confirm-actions">
            <button
              ref={cancelRef}
              className="button button-outline"
              type="button"
              onClick={close}
              disabled={deleting}
            >
              Prekliči
            </button>
            <button
              className="button button-danger"
              type="button"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? "Brisanje …" : "Izbriši"}
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
          Izbriši oglas
        </button>
      )}
    </div>
  );
}
