import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, negotiateLocale, type Locale } from "./config";
import { createI18n, type I18n } from "./i18n";
import { getMessages } from "./messages";

/**
 * The request's locale (cookie, then Accept-Language, then Slovenian). Server
 * components and `generateMetadata` only; reading cookies makes the route
 * dynamically rendered.
 */
export async function getLocale(): Promise<Locale> {
  return negotiateLocale(
    cookies().get(LOCALE_COOKIE)?.value,
    headers().get("accept-language"),
  );
}

/** `const { m, format } = await getI18n();` in a server component. */
export async function getI18n(): Promise<I18n> {
  const locale = await getLocale();
  return createI18n(locale, getMessages(locale));
}
