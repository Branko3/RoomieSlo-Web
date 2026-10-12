"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const client = createSupabaseBrowserClient();
      const { error: authError } = await client.auth.signUp({
        email: String(form.get("email") || ""),
        password: String(form.get("password") || ""),
        options: { data: { display_name: String(form.get("name") || "") } },
      });
      if (authError) setError(authError.message);
      else router.replace("/listings");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Registracija ni uspela.",
      );
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
        <p className="eyebrow">ZAČNI NA NOVO</p>
        <h1>Ustvari svoj račun</h1>
        <p className="muted">Poveži se s ljudmi, ki iščejo podoben dom.</p>
        <form onSubmit={submit}>
          <label>
            Ime in priimek
            <input name="name" placeholder="Amar H." required />
          </label>
          <label>
            E-naslov
            <input
              name="email"
              type="email"
              placeholder="ime@student.uni-lj.si"
              required
            />
          </label>
          <label>
            Geslo
            <input
              name="password"
              type="password"
              placeholder="Najmanj 8 znakov"
              minLength={8}
              required
            />
          </label>
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="button full-button"
            disabled={pending}
          >
            {pending ? "Ustvarjanje ..." : "Nadaljuj"}
          </button>
        </form>
        <p className="auth-footer">
          Že imaš račun? <Link href="/login">Prijava</Link>
        </p>
      </div>
    </div>
  );
}
