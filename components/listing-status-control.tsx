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
 * Owner-only "Označi kot zapolnjeno / na voljo" toggle. Hiding it for other
 * users is UI only; RLS (`auth.uid() = owner_id`) is the boundary.
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
