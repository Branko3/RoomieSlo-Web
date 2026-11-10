"use client";

import {
  cacheNotice,
  type ListingsView,
} from "../lib/listings/offline-listings";
import { useI18n } from "../lib/i18n/provider";

/** Tells the user that the listings shown come from the browser cache. */
export function CacheNotice({
  view,
  onRetry,
}: {
  view: ListingsView | null;
  onRetry: () => void;
}) {
  const i18n = useI18n();
  const { m } = i18n;
  const notice = view ? cacheNotice(view, i18n) : null;
  if (!notice) return null;
  return (
    <div className="cache-notice" role="status">
      <span>{notice}</span>
      <button className="text-link" type="button" onClick={onRetry}>
        {m.common.actions.retry}
      </button>
    </div>
  );
}
