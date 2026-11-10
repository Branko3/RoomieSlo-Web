"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  isConfirmationError,
  RESEND_COOLDOWN_SECONDS,
  resendConfirmation,
  type ResendResult,
} from "../lib/auth/confirmation";
import { useI18n } from "../lib/i18n/provider";
import { getSupabaseConfig } from "../lib/config";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";

export function EmailConfirmationPanel() {
  const searchParams = useSearchParams();
  const { m, format } = useI18n();
  const t = m.auth.confirmation;
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
      <h1>{error ? t.failedTitle : t.title}</h1>
      {error ? (
        <p className="error-message" role="alert">
          {t.errors[error]}
        </p>
      ) : (
        <p className="muted">{t.sent}</p>
      )}
      <form onSubmit={onSubmit} noValidate>
        <label>
          {t.email}
          <input
            type="email"
            name="email"
            autoComplete="email"
            placeholder={t.emailPlaceholder}
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
            ? t.sending
            : cooldown > 0
              ? format(t.cooldown, { seconds: cooldown })
              : t.resend}
        </button>
      </form>
      {result && (
        <p
          id="resend-status"
          className={result.ok ? "success-message" : "error-message"}
          role={result.ok ? "status" : "alert"}
        >
          {result.ok
            ? format(t.resendResult.sent, { email: result.email })
            : t.resendResult[result.error]}
        </p>
      )}
      <p className="auth-footer">
        {t.alreadyConfirmed} <Link href="/login">{t.signIn}</Link>
      </p>
    </div>
  );
}
