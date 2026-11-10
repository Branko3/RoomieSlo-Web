"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { LanguageSwitcher } from "../../components/language-switcher";
import {
  ExportError,
  exportFileName,
  exportMyData,
  privacyRequestHref,
  type ExportClient,
} from "../../lib/privacy/export";
import { DATA_CONTROLLER, privacyContact } from "../../lib/privacy/controller";
import { useI18n } from "../../lib/i18n/provider";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";

const contact = privacyContact();

function download(json: string, name: string) {
  const url = URL.createObjectURL(
    new Blob([json], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * The privacy notice. The Slovenian text is authoritative; other languages are
 * convenience translations and say so.
 */
export default function PrivacyPage() {
  const { locale, m, format } = useI18n();
  const t = m.privacy;
  const exporter = useMutation({
    mutationFn: async () => {
      const notes = t.export.notes;
      const result = await exportMyData(
        createSupabaseBrowserClient() as unknown as ExportClient,
        [notes.messages, notes.documents, notes.ratings],
      );
      download(
        JSON.stringify(result, null, 2),
        exportFileName(result.account.id, t.export.fileLabel),
      );
      return result;
    },
  });
  const error = exporter.error
    ? t.export.errors[
        exporter.error instanceof ExportError ? exporter.error.kind : "failed"
      ]
    : null;
  const request = (kind: "deletion" | "correction") =>
    privacyRequestHref(contact, {
      subject: t.requests.subjects[kind],
      accountId: t.requests.accountId,
      description: t.requests.description,
    });

  return (
    <div className="content-wrap narrow-content">
      <header className="topbar">
        <div>
          <h1>{t.title}</h1>
        </div>
      </header>
      {locale !== "sl" && <p className="muted">{t.translationNotice}</p>}

      <section className="profile-card privacy-section">
        <div>
          <b>{t.controller.title}</b>
          <p>
            {format(t.controller.body, { controller: DATA_CONTROLLER })}{" "}
            {contact ? (
              <>
                {t.controller.contact}{" "}
                <a href={`mailto:${contact}`}>{contact}</a>
              </>
            ) : (
              t.controller.contactMissing
            )}
          </p>
        </div>
      </section>

      <section className="profile-card privacy-section">
        <div>
          <b>{t.data.title}</b>
          <p>{t.data.stored}</p>
          <p>{t.data.access}</p>
          <p>{t.data.safety}</p>
          <p>{t.data.cookie}</p>
        </div>
      </section>

      <section
        className="profile-card privacy-section"
        aria-labelledby="privacy-ratings-title"
      >
        <div>
          <b id="privacy-ratings-title">{t.ratings.title}</b>
          <p>{t.ratings.basis}</p>
          <p>{t.ratings.visibility}</p>
          <p>{t.ratings.timing}</p>
          <p>
            {t.ratings.control}{" "}
            {contact ? (
              <>
                {t.ratings.writeTo} <a href={`mailto:${contact}`}>{contact}</a>.
              </>
            ) : (
              t.ratings.noContact
            )}{" "}
            {t.ratings.review}
          </p>
        </div>
      </section>

      <section className="profile-card privacy-section">
        <div>
          <b>{t.export.title}</b>
          <p>{t.export.body}</p>
          {error && (
            <p className="privacy-error" role="alert">
              {error}
            </p>
          )}
          {exporter.isSuccess && <p role="status">{t.export.ready}</p>}
        </div>
        <button
          type="button"
          className="button"
          disabled={exporter.isPending}
          onClick={() => exporter.mutate()}
        >
          {exporter.isPending ? t.export.preparing : t.export.submit}
        </button>
      </section>

      <section className="profile-card privacy-section">
        <div>
          <b>{t.deletion.title}</b>
          <p>{t.deletion.body}</p>
        </div>
        <div className="privacy-actions">
          <Link
            className="button button-outline"
            href="/profile/delete-account"
          >
            {t.deletion.deleteAccount}
          </Link>
        </div>
        {contact ? (
          <div className="privacy-actions">
            <a className="text-link" href={request("deletion")}>
              {t.deletion.requestDeletion}
            </a>
            <a className="text-link" href={request("correction")}>
              {t.deletion.requestCorrection}
            </a>
          </div>
        ) : (
          <p className="muted">{t.controller.contactMissing}</p>
        )}
      </section>
      <LanguageSwitcher className="page-language" />
    </div>
  );
}
