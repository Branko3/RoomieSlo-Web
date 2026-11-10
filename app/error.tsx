"use client";

import { useEffect } from "react";
import { useI18n } from "../lib/i18n/provider";
import { reportError } from "../lib/ops/report-error";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { m } = useI18n();
  useEffect(() => {
    reportError(error, "page");
  }, [error]);

  return (
    <div className="page-state" role="alert">
      <h1>{m.errors.page.title}</h1>
      <p>{m.errors.page.body}</p>
      <div className="state-actions">
        <button className="button" onClick={reset}>
          {m.common.actions.retry}
        </button>
        <a className="button button-outline" href="/listings">
          {m.common.actions.toListings}
        </a>
      </div>
    </div>
  );
}
