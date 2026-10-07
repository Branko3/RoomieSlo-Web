"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
