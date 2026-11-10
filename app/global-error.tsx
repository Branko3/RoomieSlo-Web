"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  negotiateLocale,
  type Locale,
} from "../lib/i18n/config";
import { reportError } from "../lib/ops/report-error";

// This replaces the root layout (and with it the I18nProvider) when that
// layout fails, and client code never imports the catalogs, so its two
// strings live here in both languages.
const COPY: Record<Locale, { title: string; reload: string }> = {
  sl: { title: "RoomieSlo trenutno ni na voljo", reload: "Osveži stran" },
  en: { title: "RoomieSlo isn't available right now", reload: "Reload page" },
};

/** The locale the root layout would have chosen: cookie, then browser languages. */
function browserLocale(): Locale {
  const cookie = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${LOCALE_COOKIE}=`))
    ?.slice(LOCALE_COOKIE.length + 1);
  return negotiateLocale(cookie, navigator.languages?.join(","));
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Slovenian on the server and the first client render (no hydration
  // mismatch), then the visitor's language.
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  useEffect(() => {
    setLocale(browserLocale());
  }, []);
  useEffect(() => {
    reportError(error, "global");
  }, [error]);

  const copy = COPY[locale];
  return (
    <html lang={locale}>
      <body>
        <main className="page-state" role="alert">
          <h1>{copy.title}</h1>
          <button className="button" onClick={reset}>
            {copy.reload}
          </button>
        </main>
      </body>
    </html>
  );
}
