import type { Messages } from "./types";

/**
 * Catalog for `useI18n()` outside an `I18nProvider`. In the app there is none,
 * so a missing provider fails loudly. Vitest aliases this module to
 * `tests/i18n-fallback.ts` (the Slovenian catalog), so component tests render
 * without a provider and keep seeing Slovenian text.
 */
export const fallbackMessages: Messages | null = null;
