"use client";

import { useEffect } from "react";
import { reportError } from "../lib/ops/report-error";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error, "global");
  }, [error]);

  return (
    <html lang="sl">
      <body>
        <div className="page-state">
          <h1>RoomieSlo trenutno ni na voljo</h1>
          <button className="button" onClick={reset}>
            Osveži stran
          </button>
        </div>
      </body>
    </html>
  );
}
