"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useAuth } from "../../components/auth-provider";
import { LanguageSwitcher } from "../../components/language-switcher";
import {
  loginErrorCode,
  safeDestination,
  validateLogin,
  type LoginError,
} from "../../lib/auth/login";
import { useI18n } from "../../lib/i18n/provider";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { pending: authLoading, error: authError, signIn } = useAuth();
  const { m } = useI18n();
  const t = m.auth.login;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<LoginError | null>(null);
  const [pending, setPending] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const validation = validateLogin(email, password);
    if (validation.error) {
      setError(validation.error);
      if (validation.error === "missing_password") {
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
        const code = loginErrorCode(result.error.message);
        // Render the alert first: it does not exist yet when focus moves to it.
        flushSync(() => setError(code));
        errorRef.current?.focus();
      } else {
        router.replace(safeDestination(params.get("returnTo")));
      }
    } catch {
      flushSync(() => setError("unreachable"));
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
        <h1>{t.title}</h1>
        {params.get("deleted") === "1" && (
          <p className="success-message" role="status">
            {t.deleted}
          </p>
        )}
        <p className="muted">{t.subtitle}</p>
        <label htmlFor="email">{t.email}</label>
        <input
          ref={emailRef}
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder={t.emailPlaceholder}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <label htmlFor="password">{t.password}</label>
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
            {error
              ? t.errors[error]
              : authError && m.auth.session.errors[authError]}
          </p>
        )}
        <button
          className="button full-button"
          type="submit"
          disabled={pending || authLoading}
        >
          {pending ? t.submitting : t.submit}
        </button>
        <p className="auth-footer">
          {t.noAccount} <Link href="/register">{t.register}</Link>
        </p>
      </form>
      <LanguageSwitcher className="page-language" />
    </div>
  );
}
