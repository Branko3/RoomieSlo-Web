"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LanguageSwitcher } from "../../components/language-switcher";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";
import {
  getRegistrationError,
  buildSignUpInput,
  RegistrationError,
  RegistrationErrors,
  RegistrationValues,
  validateRegistration,
} from "../../lib/auth/registration";
import { emailRedirectUrl } from "../../lib/auth/confirmation";
import { useI18n } from "../../lib/i18n/provider";

const initialValues: RegistrationValues = {
  displayName: "",
  email: "",
  password: "",
  adultStudent: false,
};

const FIELD_ORDER = [
  "displayName",
  "email",
  "password",
  "adultStudent",
] as const;
const FIELD_IDS = {
  displayName: "display-name",
  email: "email",
  password: "password",
  adultStudent: "adult-student",
} as const;

/** Kept as data, not text, so it follows a language switch. */
type Status =
  | { kind: "created"; email: string }
  | { kind: "error"; error: RegistrationError }
  | null;

export default function RegisterPage() {
  const router = useRouter();
  const { m, format } = useI18n();
  const t = m.auth.register;
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<RegistrationErrors>({});
  const [status, setStatus] = useState<Status>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateValue<K extends keyof RegistrationValues>(
    field: K,
    value: RegistrationValues[K],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setStatus(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationErrors = validateRegistration(values);
    setErrors(validationErrors);
    setStatus(null);

    // Focus from the fresh result: the error state is not rendered yet.
    const firstInvalid = FIELD_ORDER.find((field) => validationErrors[field]);
    if (firstInvalid) {
      document.getElementById(FIELD_IDS[firstInvalid])?.focus();
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const signUpInput = buildSignUpInput(
        values,
        emailRedirectUrl(window.location.origin),
      );
      const { data, error } = await supabase.auth.signUp(signUpInput);

      if (error) {
        setStatus({ kind: "error", error: getRegistrationError(error) });
      } else if (data.session) {
        // Email confirmation is disabled for this project: the user is already signed in.
        router.replace("/listings");
      } else {
        setStatus({ kind: "created", email: signUpInput.email });
      }
    } catch {
      setStatus({ kind: "error", error: "failed" });
    } finally {
      setIsSubmitting(false);
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
        <h1>{t.title}</h1>
        <p className="muted">{t.subtitle}</p>
        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor="display-name">{t.displayName}</label>
          <input
            id="display-name"
            name="displayName"
            value={values.displayName}
            onChange={(event) => updateValue("displayName", event.target.value)}
            aria-invalid={Boolean(errors.displayName)}
            aria-describedby={
              errors.displayName ? "display-name-error" : undefined
            }
            autoComplete="name"
          />
          {errors.displayName && (
            <p id="display-name-error" className="field-error" role="alert">
              {t.errors[errors.displayName]}
            </p>
          )}

          <label htmlFor="email">{t.email}</label>
          <input
            id="email"
            name="email"
            type="email"
            value={values.email}
            onChange={(event) => updateValue("email", event.target.value)}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "email-error" : undefined}
            autoComplete="email"
          />
          {errors.email && (
            <p id="email-error" className="field-error" role="alert">
              {t.errors[errors.email]}
            </p>
          )}

          <label htmlFor="password">{t.password}</label>
          <input
            id="password"
            name="password"
            type="password"
            value={values.password}
            onChange={(event) => updateValue("password", event.target.value)}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? "password-error" : undefined}
            autoComplete="new-password"
          />
          {errors.password && (
            <p id="password-error" className="field-error" role="alert">
              {t.errors[errors.password]}
            </p>
          )}

          <label className="checkbox-row" htmlFor="adult-student">
            <input
              id="adult-student"
              name="adultStudent"
              type="checkbox"
              checked={values.adultStudent}
              onChange={(event) =>
                updateValue("adultStudent", event.target.checked)
              }
              aria-invalid={Boolean(errors.adultStudent)}
              aria-describedby={
                errors.adultStudent ? "adult-student-error" : undefined
              }
            />
            {t.adultStudent}
          </label>
          {errors.adultStudent && (
            <p id="adult-student-error" className="field-error" role="alert">
              {t.errors[errors.adultStudent]}
            </p>
          )}

          <p
            className={`form-status ${status?.kind === "created" ? "success-message" : "error-message"}`}
            role="status"
            aria-live="polite"
          >
            {status?.kind === "created"
              ? format(t.created, { email: status.email })
              : status && t.errors[status.error]}
          </p>
          <button
            className="button full-button"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? t.submitting : t.submit}
          </button>
        </form>
        <p className="auth-footer">
          {t.haveAccount} <Link href="/login">{t.signIn}</Link>
        </p>
      </div>
      <LanguageSwitcher className="page-language" />
    </div>
  );
}
