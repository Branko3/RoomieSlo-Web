import { intlLocale, type Locale } from "./config";
import type { MessageVars, PluralForms } from "./types";

/**
 * Fills `{name}` placeholders. A placeholder without a value stays visible
 * (`{name}`), so a missing variable is noticed instead of printing "undefined".
 */
export function format(template: string, vars?: MessageVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name)
      ? String(vars[name])
      : placeholder,
  );
}

const pluralRules = new Map<Locale, Intl.PluralRules>();

/**
 * Picks the plural form for `count` with the locale's CLDR rules (Slovenian:
 * 1/101 one, 2/102 two, 3–4/103–104 few, otherwise other) and fills
 * `{count}` and any other placeholders. `vars.count` overrides the raw number,
 * e.g. with a formatted one.
 */
export function plural(
  locale: Locale,
  forms: PluralForms,
  count: number,
  vars?: MessageVars,
): string {
  let rules = pluralRules.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(intlLocale(locale));
    pluralRules.set(locale, rules);
  }
  const category = rules.select(count);
  const template =
    (category === "one" || category === "two" || category === "few"
      ? forms[category]
      : undefined) ?? forms.other;
  return format(template, { count, ...vars });
}
