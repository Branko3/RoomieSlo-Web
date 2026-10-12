"use client";

import {
  cacheNotice,
  type ListingsView,
} from "../lib/listings/offline-listings";

/** Tells the user that the listings shown come from the browser cache. */
export function CacheNotice({
  view,
  onRetry,
}: {
  view: ListingsView | null;
  onRetry: () => void;
}) {
  const notice = view ? cacheNotice(view) : null;
  if (!notice) return null;
  return (
    <div className="cache-notice" role="status">
      <span>{notice}</span>
      <button className="text-link" type="button" onClick={onRetry}>
        Poskusi znova
      </button>
    </div>
  );
}
