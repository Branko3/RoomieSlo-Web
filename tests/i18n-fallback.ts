import type { Messages } from "../lib/i18n/types";
import { sl } from "../lib/i18n/messages/sl";

// Stands in for lib/i18n/fallback.ts in Vitest (see vitest.config.ts): tests
// that render components without an I18nProvider get the Slovenian catalog.
export const fallbackMessages: Messages | null = sl;
