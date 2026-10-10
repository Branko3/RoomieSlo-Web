"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useAuth } from "../../components/auth-provider";
import {
  authMessage,
  safeDestination,
  validateLogin,
} from "../../lib/auth/login";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { session, loading: authLoading, error: authError, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!authLoading && session) router.replace("/listings");
  }, [authLoading, router, session]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const validation = validateLogin(email, password);
    if (validation.error) {
      setError(validation.error);
      if (validation.error === "Vnesite geslo.") {
        document.getElementById("password")?.focus();
      } else {
        emailRef.current?.focus();
      }
      return;
    }

    setError(null);
    setPending(true);
    try {
      const result = await signIn(validation.email, password);
      if (result.error) {
        setError(authMessage(result.error.message));
        errorRef.current?.focus();
      } else {
        router.replace(safeDestination(params.get("next")));
      }
    } catch {
      setError("Prijava ni uspela. Preverite povezavo in poskusite znova.");
      errorRef.current?.focus();
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
      <form className="auth-card" onSubmit={submit} noValidate>
        <p className="eyebrow">DOBRODOŠEL NAZAJ</p>
        <h1>Prijavi se v svoj račun</h1>
        <p className="muted">Nadaljuj z iskanjem svojega idealnega doma.</p>
        <label htmlFor="email">E-naslov</label>
        <input
          ref={emailRef}
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="ime@primer.si"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <label htmlFor="password">Geslo</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {(error || authError) && (
          <p
            ref={errorRef}
            className="error-message"
            role="alert"
            tabIndex={-1}
          >
            {error || authError}
          </p>
        )}
        <button
          className="button full-button"
          type="submit"
          disabled={pending || authLoading}
        >
          {pending ? "Prijavljanje ..." : "Prijava"}
        </button>
        <p className="auth-footer">
          Še nimaš računa? <Link href="/register">Registriraj se</Link>
        </p>
      </form>
    </div>
  );
}
