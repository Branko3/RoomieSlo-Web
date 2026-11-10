import type { Locale } from "./config";
import { format, plural } from "./format";
import { getFormatters, type Formatters } from "./formatters";
import type { MessageVars, Messages, PluralForms } from "./types";

/** What `useI18n()` (client) and `getI18n()` (server) return. */
export type I18n = {
  locale: Locale;
  /** The active catalog: `m.listings.mine.title`. */
  m: Messages;
  /** Fills `{name}` placeholders: `format(m.chat.greeting, { name })`. */
  format: (template: string, vars?: MessageVars) => string;
  /** Plural form for `count` in the active locale: `plural(m.search.results, n)`. */
  plural: (forms: PluralForms, count: number, vars?: MessageVars) => string;
  formatters: Formatters;
};

export function createI18n(locale: Locale, messages: Messages): I18n {
  return {
    locale,
    m: messages,
    format,
    plural: (forms, count, vars) => plural(locale, forms, count, vars),
    formatters: getFormatters(locale),
  };
}
