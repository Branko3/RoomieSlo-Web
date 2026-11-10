"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState } from "react";
import { useAuth } from "../../../components/auth-provider";
import {
  CONFIRMATION_PHRASES,
  deleteOwnAccount,
  type DeleteAccountClient,
  type DeleteAccountFailure,
} from "../../../lib/account/deletion";
import { useI18n } from "../../../lib/i18n/provider";
import { privacyContact } from "../../../lib/privacy/controller";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";
import { ChevronLeftIcon } from "../../../components/icons";

const contact = privacyContact();

/** Splits `template` at `{name}` so a React node can stand in its place. */
function around(template: string, name: string): [string, string] {
  const [before, after = ""] = template.split(`{${name}}`);
  return [before, after];
}

/** Self-service account deletion (approved retention matrix, 2026-10-12). */
export default function DeleteAccountPage() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { locale, m, format } = useI18n();
  const t = m.account.deletion;
  // English asks for "DELETE"; the function always receives the canonical phrase.
  const phrase = CONFIRMATION_PHRASES[locale];
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<DeleteAccountFailure | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    const result = await deleteOwnAccount(
      createSupabaseBrowserClient() as unknown as DeleteAccountClient,
      { password, confirm, locale },
    );
    if (result.ok) {
      // The account is gone; clear the session and every cached user datum.
      await signOut();
      router.replace("/login?deleted=1");
      return;
    }
    setError(result.kind);
    setPending(false);
    requestAnimationFrame(() => errorRef.current?.focus());
  }

  const [finalBefore, finalAfter] = around(t.final, "strong");
  const [confirmBefore, confirmAfter] = around(t.confirmLabel, "phrase");

  return (
    <div className="content-wrap narrow-content delete-account">
      <Link className="back-link" href="/profile">
        <ChevronLeftIcon size={18} />
        {t.back}
      </Link>
      <h1>{t.title}</h1>
      <p>
        {finalBefore}
        <b>{t.finalStrong}</b>
        {finalAfter}
      </p>

      <section className="profile-card privacy-section">
        <div>
          <b>{t.removedTitle}</b>
          <ul>
            <li>{t.removed.login}</li>
            <li>{t.removed.profile}</li>
            <li>{t.removed.content}</li>
            <li>{t.removed.document}</li>
            <li>{t.removed.requests}</li>
            <li>{t.removed.ratings}</li>
          </ul>
        </div>
      </section>

      <section className="profile-card privacy-section">
        <div>
          <b>{t.keptTitle}</b>
          <ul>
            <li>{t.kept.messages}</li>
            <li>{t.kept.reports}</li>
            <li>{t.kept.cohabitations}</li>
            <li>{t.kept.ratings}</li>
            <li>{t.kept.safety}</li>
          </ul>
          <p className="muted">{t.backups}</p>
        </div>
      </section>

      <form className="profile-form" onSubmit={submit} noValidate>
        <label htmlFor="delete-password">{t.password}</label>
        <input
          id="delete-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={pending}
        />
        <label htmlFor="delete-confirm">
          {confirmBefore}
          <b>{phrase}</b>
          {confirmAfter}
        </label>
        <input
          id="delete-confirm"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          disabled={pending}
        />
        {error && (
          <p
            ref={errorRef}
            className="error-message"
            role="alert"
            tabIndex={-1}
          >
            {format(t.errors[error], { phrase })}
            {contact && (
              <>
                {" "}
                <a href={`mailto:${contact}`}>{contact}</a>
              </>
            )}
          </p>
        )}
        <div className="profile-form-actions">
          <Link className="button button-outline" href="/profile">
            {t.cancel}
          </Link>
          <button
            className="button button-danger"
            type="submit"
            disabled={pending}
            aria-busy={pending || undefined}
          >
            {pending ? t.submitting : t.submit}
          </button>
        </div>
      </form>
    </div>
  );
}
