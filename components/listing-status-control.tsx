"use client";

import { useEffect, useState } from "react";
import { getSupabaseConfig } from "../lib/config";
import {
  filledToggleLabel,
  setListingFilled,
  toggleFilledOptimistically,
  type ListingStatusClient,
} from "../lib/listings/listing-status";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";

/**
 * "Označi kot zapolnjeno / na voljo" for a listing the caller already knows
 * is the user's own (e.g. the "Moji oglasi" list, which only loads them).
 * RLS (`auth.uid() = owner_id`) remains the boundary.
 */
export function ListingStatusToggle({
  listingId,
  isFilled,
  onChange,
}: {
  listingId: string;
  isFilled: boolean;
  onChange: (filled: boolean) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    if (saving) return;
    setSaving(true);
    setError(null);
    const client =
      createSupabaseBrowserClient() as unknown as ListingStatusClient;
    const result = await toggleFilledOptimistically(
      isFilled,
      onChange,
      (next) => setListingFilled(client, listingId, next),
    );
    if (!result.ok) setError(result.error.message);
    setSaving(false);
  }

  return (
    <div className="listing-status-control">
      <button
        className="button button-outline"
        type="button"
        onClick={toggle}
        disabled={saving}
        aria-busy={saving || undefined}
      >
        {filledToggleLabel(isFilled)}
      </button>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * The same toggle on a listing page anyone can open: shown only to the
 * owner. Hiding it for other users is UI only; RLS is the boundary.
 */
export function ListingStatusControl({
  listingId,
  ownerId,
  isFilled,
  onChange,
}: {
  listingId: string;
  ownerId: string;
  isFilled: boolean;
  onChange: (filled: boolean) => void;
}) {
  const [isOwner, setIsOwner] = useState(false);

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

  if (!isOwner) return null;
  return (
    <ListingStatusToggle
      listingId={listingId}
      isFilled={isFilled}
      onChange={onChange}
    />
  );
}
