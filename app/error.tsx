"use client";

import { useEffect } from "react";
import { reportError } from "../lib/ops/report-error";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error, "page");
  }, [error]);

  return (
    <div className="page-state" role="alert">
      <h1>Nekaj je šlo narobe</h1>
      <p>Vsebino lahko poskusiš naložiti znova.</p>
      <div className="state-actions">
        <button className="button" onClick={reset}>
          Poskusi znova
        </button>
        <a className="button button-outline" href="/listings">
          Na oglase
        </a>
      </div>
    </div>
  );
}
