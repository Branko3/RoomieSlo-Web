"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";
import { getSafeReturnPath } from "../../lib/auth/routes";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const client = createSupabaseBrowserClient();
      const { error: authError } = await client.auth.signInWithPassword({
        email: String(form.get("email") || ""),
        password: String(form.get("password") || ""),
      });
      if (authError) setError(authError.message);
      else router.replace(getSafeReturnPath(searchParams.get("returnTo")));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Prijava ni uspela.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="auth-page">
      <div className="auth-brand">
        <span className="brand-mark">R</span>
        <b>
          Roomie<span>Slo</span>
        </b>
      </div>
      <div className="auth-card">
        <p className="eyebrow">DOBRODOŠEL NAZAJ</p>
        <h1>Prijavi se v svoj račun</h1>
        <p className="muted">Nadaljuj z iskanjem svojega idealnega doma.</p>
        <form onSubmit={submit}>
          <label>
            E-naslov
            <input
              name="email"
              type="email"
              placeholder="ime@primer.si"
              required
            />
          </label>
          <label>
            Geslo
            <input
              name="password"
              type="password"
              placeholder="••••••••"
              required
            />
          </label>
          <div className="auth-options">
            <label className="checkbox">
              <input type="checkbox" /> Zapomni si me
            </label>
            <a href="#">Pozabljeno geslo?</a>
          </div>
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
          <button
            className="button full-button"
            type="submit"
            disabled={pending}
          >
            {pending ? "Prijavljanje ..." : "Prijava"}
          </button>
        </form>
        <p className="auth-footer">
          Še nimaš računa? <Link href="/register">Registriraj se</Link>
        </p>
      </div>
    </div>
  );
}
