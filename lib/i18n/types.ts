import type { sl } from "./messages/sl";

/**
 * Plural forms with a `{count}` placeholder, chosen with Intl.PluralRules.
 * Slovenian fills all four (write them with `pluralForms` from
 * `messages/plural.ts`); English needs `one` and `other`, and a missing
 * `two`/`few` falls back to `other`.
 */
export type PluralForms = {
  one: string;
  two?: string;
  few?: string;
  other: string;
};

/** Strings widen to `string`; nested sections and plural objects keep their shape. */
export type CatalogShape<T> = T extends string
  ? string
  : T extends object
    ? { [K in keyof T]: CatalogShape<T[K]> }
    : T;

/**
 * The catalog shape, taken from the Slovenian catalog. Every other language is
 * typed against it, so a missing or extra key fails `npm run typecheck`.
 * Values are strings and plural objects only: the catalog travels as JSON from
 * the root layout to the client provider.
 */
export type Messages = CatalogShape<typeof sl>;

export type Namespace = keyof Messages;

/** Values for `{name}` placeholders. */
export type MessageVars = Record<string, string | number>;
