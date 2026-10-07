"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
