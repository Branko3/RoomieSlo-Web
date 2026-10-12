"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabaseConfig } from "../lib/config";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";

/**
 * Shows owner-only actions on a listing. This only hides UI for other users;
 * RLS (`auth.uid() = owner_id`) remains the authorization boundary.
 */
export function OwnerListingActions({
  listingId,
  ownerId,
}: {
  listingId: string;
  ownerId: string;
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
    <Link
      className="button button-outline"
      href={`/listings/${encodeURIComponent(listingId)}/edit`}
    >
      Uredi oglas
    </Link>
  );
}
