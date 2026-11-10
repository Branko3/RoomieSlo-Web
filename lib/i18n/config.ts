/** Interface languages. Slovenian is the default; the design allows more. */
export const LOCALES = ["sl", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "sl";

/** Functional preference cookie written by the language switcher. */
export const LOCALE_COOKIE = "roomieslo-locale";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Dates and times are always shown in Ljubljana time, whatever the language. */
export const TIME_ZONE = "Europe/Ljubljana";

export function isLocale(value: unknown): value is Locale {
  return LOCALES.includes(value as Locale);
}

/** BCP 47 tag for Intl formatters: day–month order in both languages. */
export function intlLocale(locale: Locale): "sl-SI" | "en-GB" {
  return locale === "en" ? "en-GB" : "sl-SI";
}

/** `Set-Cookie`/`document.cookie` value that stores the choice for a year. */
export function localeCookie(locale: Locale): string {
  return `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax`;
}

/**
 * The active locale: a valid cookie wins; otherwise English only when the
 * browser's Accept-Language ranks English above Slovenian; otherwise Slovenian.
 */
export function negotiateLocale(
  cookie: string | null | undefined,
  acceptLanguage: string | null | undefined,
): Locale {
  if (isLocale(cookie)) return cookie;
  const ranked = (acceptLanguage ?? "")
    .split(",")
    .map((entry, index) => {
      const [tag, ...params] = entry.split(";");
      const q = params
        .map((param) => param.trim().toLowerCase())
        .find((param) => param.startsWith("q="));
      // An unreadable q-value counts as "not acceptable".
      const quality = q === undefined ? 1 : Number(q.slice(2)) || 0;
      return {
        language: tag.trim().toLowerCase().split("-")[0],
        quality,
        index,
      };
    })
    .filter(({ language, quality }) => isLocale(language) && quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index);
  return ranked[0]?.language === "en" ? "en" : DEFAULT_LOCALE;
}
