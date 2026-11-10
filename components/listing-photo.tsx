"use client";

import Image from "next/image";
import { useState } from "react";
import { useI18n } from "../lib/i18n/provider";
import { photoAlt, safePhotoUrl } from "../lib/listings/listing-photo";
import type { Listing } from "../lib/supabase/mappers";
import { HomeIcon } from "./icons";

/**
 * Listing photo with a decorative placeholder when the listing has no usable
 * photo or the image fails to load. Photos are loaded lazily and served as-is
 * (`unoptimized`), so no image domains need to be configured.
 */
export function ListingPhoto({
  listing,
  sizes,
  priority = false,
}: {
  listing: Pick<Listing, "image" | "title" | "district">;
  sizes: string;
  priority?: boolean;
}) {
  const { m, format } = useI18n();
  const url = safePhotoUrl(listing.image);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (!url || failedUrl === url) {
    return (
      <span className="listing-placeholder" aria-hidden="true">
        <HomeIcon size={40} strokeWidth={1.5} />
      </span>
    );
  }

  return (
    <Image
      className="listing-photo"
      src={url}
      alt={photoAlt(listing, m.listings, format)}
      fill
      sizes={sizes}
      unoptimized
      priority={priority}
      referrerPolicy="no-referrer"
      onError={() => setFailedUrl(url)}
    />
  );
}
