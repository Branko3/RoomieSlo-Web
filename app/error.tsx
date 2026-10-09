"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="page-state" role="alert">
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
    </main>
  );
}
