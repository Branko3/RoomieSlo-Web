"use client";

import { createContext, useContext, useMemo } from "react";
import type { Locale } from "./config";
import { fallbackMessages } from "./fallback";
import { createI18n, type I18n } from "./i18n";
import type { Messages } from "./types";

const I18nContext = createContext<I18n | null>(null);

/**
 * Receives the active catalog as plain JSON from the root layout, so the text
 * travels in the RSC payload instead of client JavaScript.
 */
export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Messages;
  children: React.ReactNode;
}) {
  const value = useMemo(() => createI18n(locale, messages), [locale, messages]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

let fallback: I18n | null = null;

/** `const { locale, m, format, plural, formatters } = useI18n();` */
export function useI18n(): I18n {
  const value = useContext(I18nContext);
  if (value) return value;
  if (fallbackMessages)
    return (fallback ??= createI18n("sl", fallbackMessages));
  throw new Error(
    "useI18n must be used inside I18nProvider (rendered by app/layout.tsx).",
  );
}
