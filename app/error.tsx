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
    <div className="page-state">
      <h1>Nekaj je šlo narobe</h1>
      <p>Vsebino lahko poskusiš naložiti znova.</p>
      <button className="button" onClick={reset}>
        Poskusi znova
      </button>
    </div>
  );
}
