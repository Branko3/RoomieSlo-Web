import type { PluralForms } from "../types";

/**
 * A Slovenian plural entry: all four CLDR forms are required, each with a
 * `{count}` placeholder where the number is shown. The return type is the
 * shared `PluralForms`, so English may give only `one` and `other`.
 */
export function pluralForms(forms: Required<PluralForms>): PluralForms {
  return forms;
}
