"use client";

import Image from "next/image";
import { useState } from "react";
import {
  photoAlt,
  PHOTO_PLACEHOLDER,
  safePhotoUrl,
} from "../lib/listings/listing-photo";
import type { Listing } from "../lib/supabase/mappers";

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
  const url = safePhotoUrl(listing.image);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (!url || failedUrl === url) {
    return (
      <span className="listing-placeholder" aria-hidden="true">
        {PHOTO_PLACEHOLDER}
      </span>
    );
  }

  return (
    <Image
      className="listing-photo"
      src={url}
      alt={photoAlt(listing)}
      fill
      sizes={sizes}
      unoptimized
      priority={priority}
      referrerPolicy="no-referrer"
      onError={() => setFailedUrl(url)}
    />
  );
}
