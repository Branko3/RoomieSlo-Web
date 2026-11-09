# English interface ("Slovenščina / English")

- Status: In progress
- Date: 2026-11-09
- Web surfaces: every route; a language switcher in the signed-in shell and on the public pages (`/login`, `/register`, `/privacy`, `/auth-error`).
- Android: no schema, policy or Edge Function change; Android keeps working unchanged.

## Problem

The web app is Slovenian only. Every string is a literal in a component or in `lib/`, `<html lang="sl">` is fixed in `app/layout.tsx`, and dates, times and amounts are formatted with a hardcoded `"sl-SI"`. A large share of the target audience (exchange and international students in Slovenia) cannot use the app comfortably, and there is no seam where another language could be added.

## Decisions

| Question                | Decision                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Languages               | Slovenian (`sl`, default) and English (`en`). The design allows more, but only these two ship.                                                                                                                                                                                                                                                                                                                |
| Library                 | None. A small typed dictionary in `lib/i18n/`. `next-intl` would add client JavaScript, and `/chats/[matchId]` is already at 193 of 200 kB (gzipped first-load budget).                                                                                                                                                                                                                                       |
| Where the catalog lives | The server picks the active locale's catalog in the root layout and passes it to a client `I18nProvider` as plain JSON. The text travels in the RSC payload, not in JS chunks, so the second language costs no first-load JavaScript, and moving the Slovenian literals out of components should make chunks _smaller_. The catalog must therefore be serializable: strings and plural objects, no functions. |
| URLs                    | Unchanged (no `/en/...` prefix). Every page is `noindex`, so localized URLs bring no SEO value, and prefixes would touch middleware, route guards, `lib/navigation.ts` and every e2e spec.                                                                                                                                                                                                                    |
| Choosing the locale     | 1. The `roomieslo-locale` cookie (`sl` / `en`), set by the switcher, one year, `Path=/`, `SameSite=Lax`. 2. Without a cookie: `Accept-Language`, choosing `en` only when the browser ranks English above Slovenian. 3. Otherwise `sl`.                                                                                                                                                                        |
| Switching               | The switcher writes the cookie and calls `router.refresh()`; the root layout re-renders with the new catalog and `lang`. No full reload and no lost client state.                                                                                                                                                                                                                                             |
| Stored in the profile?  | Not in this version (cookie only, per browser). A `profiles.locale` column is only worth adding when the app sends its own email or push notifications.                                                                                                                                                                                                                                                       |
| English variant         | British spelling (`favourites`), informal second person, short. Dates and numbers use `en-GB` (day–month order, `€1,250`). The time zone stays `Europe/Ljubljana`.                                                                                                                                                                                                                                            |
| Rendering               | Reading the cookie in the root layout makes routes dynamically rendered. That is acceptable (most pages are client components that fetch after mount anyway). The build and `perf:budget` must still pass.                                                                                                                                                                                                    |

## What stays Slovenian

- **User content**: listing titles and descriptions, bios, messages. Nothing is machine-translated.
- **Stored values**: report reasons are saved as Slovenian text (`REPORT_REASONS` in `lib/reports/report.ts`, shared with Android). The stored value stays; the English UI shows a translated label mapped from it. Admin views map the same way.
- **The account-deletion confirmation phrase**: the `delete-account` function checks `IZBRIŠI`. The English UI asks the user to type `DELETE`, validates that locally and sends the canonical `IZBRIŠI`. The phrase only guards against accidental deletion; the user is already authenticated as the account owner, so no Edge Function change or redeploy is needed.
- **Supabase Auth emails** (confirmation, password reset): their templates live in the Supabase dashboard and have one language. Out of scope (open question).
- **Internal values**: day keys formatted with `en-CA` (ISO dates, not display text) and the `toLocaleLowerCase("sl")` used for search matching.
- **`lib/data.ts`**: unused preview data.

## Architecture

```
lib/i18n/
  config.ts          LOCALES, DEFAULT_LOCALE, LOCALE_COOKIE, negotiateLocale(cookie, acceptLanguage), intlLocale(locale) → "sl-SI" | "en-GB"
  format.ts          format(template, vars) for "{name}" placeholders; plural(locale, forms, count, vars) via Intl.PluralRules
  formatters.ts      getFormatters(locale): memoized date/time/currency/number formatters (replaces module-level "sl-SI" formatters)
  types.ts           Messages (the widened shape of the Slovenian catalog), PluralForms
  server.ts          getLocale() / getI18n() for server components and generateMetadata (cookies() + headers())
  provider.tsx       "use client" I18nProvider + useI18n() → { locale, m, format, plural, formatters }
  fallback.ts        exports null; vitest aliases it to the Slovenian catalog so component tests render without a provider
  messages/
    sl/<namespace>.ts   one file per namespace, plus index.ts that assembles them
    en/<namespace>.ts   typed as Messages["<namespace>"], so a missing or extra key fails `npm run typecheck`
```

**Namespaces** (one owner each, so work can proceed in parallel): `common`, `shell`, `errors`, `auth`, `account`, `privacy`, `profile`, `questionnaire`, `ratings`, `cohabitation`, `listings`, `search`, `favorites`, `matching`, `chat`, `reports`, `admin`.

**Access** is by property, not by string key: `const { m, format } = useI18n(); m.listings.mine.title`. TypeScript checks every access without template-literal path types, and an unused key is easy to find.

**Plurals** are objects `{ one, two, few, other }` with a `{count}` placeholder. `Intl.PluralRules("sl")` already produces exactly the Slovenian categories (1/101 → one, 2/102 → two, 3–4 → few, otherwise other), so `lib/listings/result-label.ts` and the other hand-written Slovenian plural helpers become catalog entries with identical output. English uses `one` and `other`; `two` and `few` are optional and fall back to `other`.

**`lib/` code that returns user-visible text** (error mappers in `lib/auth`, `reportCopy`, `lib/cohabitation`, rating labels, listing form validation, and so on) changes in one of two ways:

1. Preferably it returns a typed code (`"invalid_reason"`, `{ kind: "rate_limited" }`) and the component looks up the text; or
2. where the text is assembled from data, the function takes the `locale` (for formatters) or the relevant catalog section as an argument.

Business logic and stored values never depend on the locale.

**Metadata**: page titles move to `generateMetadata` using `getI18n()`.

## Switcher

- `components/language-switcher.tsx`: two options, "Slovenščina" and "English", each named in its own language and carrying `lang` on the option (accessibility). The current one is marked `aria-current`/selected.
- Signed in: in the settings panel on `/profile` and in the shell header's overflow area. The bottom navigation keeps its five items.
- Signed out: in the footer of `/login`, `/register`, `/privacy` and `/auth-error`.

## Privacy and consent

The locale cookie is a functional preference set at the user's request and holds no personal data, so it needs no consent banner. `/privacy` gets one sentence about it. The English privacy notice is a convenience translation; the Slovenian text prevails, and the owner must review it before launch (see open questions in `web-feature-status.md`).

## Glossary (Slovenian → English)

| Slovenian                       | English                                       | Note                                                             |
| ------------------------------- | --------------------------------------------- | ---------------------------------------------------------------- |
| Oglas / Moji oglasi             | Listing / My listings                         |                                                                  |
| Objavi oglas                    | Post a listing                                |                                                                  |
| Na voljo / Zapolnjeno           | Available / Filled                            |                                                                  |
| Sostanovalec                    | Roommate                                      |                                                                  |
| Združljivost / Ujemanje         | Compatibility / Match                         |                                                                  |
| Priporočila                     | Recommendations                               |                                                                  |
| Priljubljeni                    | Favourites                                    |                                                                  |
| Prijava (v račun)               | Sign in                                       | "Prijava" also means a report; never translate one as the other. |
| Prijava (uporabnika ali oglasa) | Report                                        |                                                                  |
| Registracija                    | Sign up                                       |                                                                  |
| Vpisnica / akademsko potrdilo   | Enrolment certificate / academic verification |                                                                  |
| Vprašalnik o življenjskem slogu | Lifestyle questionnaire                       |                                                                  |
| Ne želim odgovoriti             | Prefer not to say                             |                                                                  |
| Živiva skupaj / sobivanje       | We live together / living together            |                                                                  |
| Ocene sostanovalcev             | Roommate ratings                              |                                                                  |
| Pogovori / Klepet               | Chats / Chat                                  |                                                                  |
| Prebrano / Dostavljeno          | Read / Delivered                              |                                                                  |
| Blokiraj / Odblokiraj           | Block / Unblock                               |                                                                  |
| Izbriši račun                   | Delete account                                |                                                                  |

Slovenian gendered forms such as "rad(a)" become neutral English.

## Delivery plan

1. **Foundation**: `lib/i18n/*`, the catalog skeleton for every namespace, the provider in the root layout with `lang`, locale negotiation, the switcher, the vitest alias, `getFormatters`. It migrates the shared surfaces (`app/layout.tsx`, `error.tsx`, `global-error.tsx`, `not-found.tsx`, `components/app-shell.tsx`, `data-states.tsx`, `providers.tsx`, `session-provider.tsx`, `cache-notice.tsx`, `lib/navigation.ts`, `lib/seo.ts`, `lib/supabase/*`) into `common`, `shell` and `errors`.
2. **Areas in parallel**, each owning its namespaces, its files and their tests:
   - **Auth, account and privacy**: `/login`, `/register`, `/auth/confirmation`, `/auth-error`, `/academic-verification`, `/privacy`, `/profile/delete-account`; `lib/auth`, `lib/academic`, `lib/account`.
   - **Profile, questionnaire, ratings and cohabitation**: `/profile`, `/profile/questionnaire`; `lib/questionnaire`, `lib/profile`, `lib/ratings`, `lib/cohabitation`, plus their components.
   - **Listings, search and favourites**: `/listings/**`, `/search`, `/favorites`; `lib/listings`, `lib/favorites`, plus their components.
   - **Matching, chat, reports and admin**: `/recommendations`, `/chats/**`, `/report/[userId]`, `/admin/**`; `lib/matching`, `lib/chat`, `lib/reports`, `lib/admin`, plus their components.
3. **Integration**: the regression guard, the full check suite, budget comparison, this record and the status table.

## Acceptance criteria

- [ ] Every route renders entirely in English when the locale is `en` (apart from the items under "What stays Slovenian"), and exactly as before when it is `sl`.
- [ ] `<html lang>` matches the active locale.
- [ ] Without a cookie, a browser that prefers English gets English; every other browser gets Slovenian.
- [ ] The switcher is reachable signed in and signed out, works by keyboard, persists across reloads and sessions in the same browser, and changes the language without a full reload.
- [ ] Dates, times, amounts and counts use the locale's formatting and plural rules, in Ljubljana time.
- [ ] Report reasons are still stored with their Slovenian values; account deletion works from the English UI with `DELETE`.
- [ ] A missing English key, or a placeholder mismatch between the two languages, fails CI.
- [ ] No new Slovenian literal outside `lib/i18n/messages/` passes CI (static guard with an explicit allowlist).
- [ ] `npm run typecheck`, `lint`, `format:check`, `test`, `test:coverage`, `build` and `perf:budget` pass; no route's first-load JavaScript grows by more than 1 kB.
- [ ] Existing Slovenian component and e2e tests pass unchanged, except where `lib/` functions now return codes instead of text.

## Testing contract

- **Unit**: `negotiateLocale` (cookie wins; `Accept-Language` ordering and q-values; invalid cookie; missing header); `format` (missing variables left visible, repeated placeholders); `plural` for `sl` (1, 2, 3, 4, 5, 101, 102, 105) and `en` (1, 2); `getFormatters` per locale (Ljubljana time, euro amounts); the parity of both catalogs (same keys, same placeholder set per entry, complete plural forms, no empty strings); each `lib/` function that now returns a code.
- **Static**: a scan of `app/`, `components/` and `lib/` (except `lib/i18n/messages/` and tests) for Slovenian letters `č š ž` in string and JSX literals, with an explicit allowlist (stored values such as `REPORT_REASONS`, `DELETION_PHRASE`, the `"sl"` locale tags, `lib/data.ts`).
- **Component**: `I18nProvider` with `en` renders English text in a representative page component; the switcher writes the cookie, calls `router.refresh()` and is keyboard operable; existing tests keep using the Slovenian fallback.
- **End-to-end**: `e2e/language.spec.ts` sets the cookie to `en`, checks `/login` and `/register` text and `html[lang=en]`, switches back through the UI and checks `lang=sl` after a reload. Add an English pass of `/login` to the axe list.

## Implementation

To be filled in when the work lands.

## Test status

To be filled in when the work lands.
