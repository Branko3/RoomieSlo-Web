"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  confirmationErrorMessages,
  RESEND_COOLDOWN_SECONDS,
  resendConfirmation,
  type ConfirmationError,
  type ResendResult,
} from "../lib/auth/confirmation";
import { getSupabaseConfig } from "../lib/config";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";

function isConfirmationError(value: string | null): value is ConfirmationError {
  return value !== null && value in confirmationErrorMessages;
}

export function EmailConfirmationPanel() {
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");
  const error = isConfirmationError(errorParam) ? errorParam : null;
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ResendResult | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(
      () => setCooldown((value) => value - 1),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || cooldown > 0) return;
    setPending(true);
    setResult(null);
    const client = getSupabaseConfig().configured
      ? createSupabaseBrowserClient()
      : null;
    const outcome = await resendConfirmation(
      client,
      email,
      window.location.origin,
    );
    setResult(outcome);
    setPending(false);
    if (outcome.ok) setCooldown(RESEND_COOLDOWN_SECONDS);
  }

  const fieldError = result && !result.ok && result.field === "email";

  return (
    <div className="auth-card">
      <h1>{error ? "Potrditev ni uspela" : "Preveri svojo e-pošto"}</h1>
      {error ? (
        <p className="error-message" role="alert">
          {confirmationErrorMessages[error]}
        </p>
      ) : (
        <p className="muted">
          Poslali smo ti povezavo za potrditev računa. Odpri jo na tej napravi,
          nato se lahko prijaviš.
        </p>
      )}
      <form onSubmit={onSubmit} noValidate>
        <label>
          E-naslov
          <input
            type="email"
            name="email"
            autoComplete="email"
            placeholder="ime@student.uni-lj.si"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={fieldError || undefined}
            aria-describedby={result ? "resend-status" : undefined}
          />
        </label>
        <button
          className="button full-button"
          type="submit"
          disabled={pending || cooldown > 0}
        >
          {pending
            ? "Pošiljanje …"
            : cooldown > 0
              ? `Ponovno pošlji čez ${cooldown} s`
              : "Pošlji potrditveno e-sporočilo znova"}
        </button>
      </form>
      {result && (
        <p
          id="resend-status"
          className={result.ok ? "success-message" : "error-message"}
          role={result.ok ? "status" : "alert"}
        >
          {result.message}
        </p>
      )}
      <p className="auth-footer">
        Si že potrdil e-naslov? <Link href="/login">Prijava</Link>
      </p>
    </div>
  );
}
