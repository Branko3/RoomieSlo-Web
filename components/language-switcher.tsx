"use client";

import { useRouter } from "next/navigation";
import { useId, useTransition } from "react";
import { LOCALES, localeCookie, type Locale } from "../lib/i18n/config";
import { useI18n } from "../lib/i18n/provider";

/**
 * "Slovenščina / English". Stores the choice in the locale cookie for a year
 * and re-renders the server tree (`router.refresh()`), so the root layout sends
 * the other catalog and `<html lang>` without a full reload or lost state.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, m } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const labelId = useId();

  const choose = (next: Locale) => {
    if (next === locale) return;
    document.cookie = localeCookie(next);
    startTransition(() => router.refresh());
  };

  return (
    <div
      className={`language-switcher${className ? ` ${className}` : ""}`}
      role="group"
      aria-labelledby={labelId}
      aria-busy={pending || undefined}
    >
      <span id={labelId} className="language-switcher-label">
        {m.common.language.label}
      </span>
      {LOCALES.map((option) => (
        <button
          key={option}
          type="button"
          lang={option}
          className="language-option"
          aria-pressed={option === locale}
          onClick={() => choose(option)}
        >
          {m.common.language.names[option]}
        </button>
      ))}
    </div>
  );
}
