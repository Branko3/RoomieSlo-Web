"use client";

import Link from "next/link";
import { FormEvent, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";
import {
  getRegistrationErrorMessage,
  buildSignUpInput,
  RegistrationErrors,
  RegistrationValues,
  validateRegistration,
} from "../../lib/auth/registration";

const initialValues: RegistrationValues = {
  displayName: "",
  email: "",
  password: "",
};

export default function RegisterPage() {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<RegistrationErrors>({});
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const firstInvalidRef = useRef<HTMLInputElement>(null);

  function updateValue(field: keyof RegistrationValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setStatus("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationErrors = validateRegistration(values);
    setErrors(validationErrors);
    setStatus("");

    if (Object.keys(validationErrors).length > 0) {
      firstInvalidRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const signUpInput = buildSignUpInput(values);
      const { data, error } = await supabase.auth.signUp(signUpInput);

      if (error) {
        setStatus(getRegistrationErrorMessage(error));
      } else if (data.session) {
        setStatus(
          "Račun je ustvarjen. Lahko nadaljuješ na prijavo, ko bo ta omogočena.",
        );
      } else {
        setStatus(
          `Račun je ustvarjen. Na ${signUpInput.email} smo poslali potrditveno povezavo. Preveri e-pošto in nato nadaljuj na prijavo.`,
        );
      }
    } catch {
      setStatus("Registracije trenutno ni mogoče dokončati. Poskusi znova.");
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
        <p className="eyebrow">ZAČNI NA NOVO</p>
        <h1>Ustvari svoj račun</h1>
        <p className="muted">Poveži se s ljudmi, ki iščejo podoben dom.</p>
        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor="display-name">Ime in priimek</label>
          <input
            ref={errors.displayName ? firstInvalidRef : undefined}
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
              {errors.displayName}
            </p>
          )}

          <label htmlFor="email">E-naslov</label>
          <input
            ref={
              errors.email && !errors.displayName ? firstInvalidRef : undefined
            }
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
              {errors.email}
            </p>
          )}

          <label htmlFor="password">Geslo</label>
          <input
            ref={
              errors.password && !errors.displayName && !errors.email
                ? firstInvalidRef
                : undefined
            }
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
              {errors.password}
            </p>
          )}

          <p
            className={`form-status ${status.includes("Račun je ustvarjen") ? "success-message" : "error-message"}`}
            role="status"
            aria-live="polite"
          >
            {status}
          </p>
          <button
            className="button full-button"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Ustvarjam račun…" : "Ustvari račun"}
          </button>
        </form>
        <p className="auth-footer">
          Že imaš račun? <Link href="/login">Prijava</Link>
        </p>
      </div>
    </div>
  );
}
