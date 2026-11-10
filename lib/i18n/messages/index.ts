import type { Locale } from "../config";
import type { Messages } from "../types";
import { en } from "./en";
import { sl } from "./sl";

/**
 * Server-only entry point to the catalogs. Client components never import
 * this folder (tests/i18n-client-imports.test.ts): they get the active catalog
 * from `useI18n()`.
 */
export const catalogs: Record<Locale, Messages> = { sl, en };

export function getMessages(locale: Locale): Messages {
  return catalogs[locale];
}
