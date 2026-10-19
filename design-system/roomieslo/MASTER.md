# RoomieSlo design system (master)

> Page overrides live in `design-system/roomieslo/pages/<page>.md` and win over this file.
> Source of truth for values is the token layer at the top of `app/globals.css`;
> this file explains the decisions. Originally generated with ui-ux-pro-max
> (motion 3, density 5) on 2026-10-19, then revised: the generated trust-blue /
> orange palette and Outfit + Work Sans were replaced to keep RoomieSlo's
> green/amber identity.

## Direction: "oglasna deska"

Students find rooms through "Oddam sobo" flyers on faculty notice boards. The one
bold element is the listing card as a paper flyer with a perforated tear-off
strip carrying the price. Everything else stays quiet.

## Colour

| Name          | Light                 | Dark                  | Role                                                                                                                    |
| ------------- | --------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Smreka        | `#2f6f5e`             | `#7cc4a8`             | Action colour, active nav                                                                                               |
| Gozd          | `#1d5143`             | `#9ed3bf`             | Focus ring, accent text, links                                                                                          |
| Med           | `#e7b75f`             | `#e7b75f`             | Attention only (new, recommended, unread), plus the one rule in the dashboard hero; never text on light, never a button |
| Tinta         | `#1c2925`             | `#e4ede8`             | Text                                                                                                                    |
| Papir / Deska | `#f5f8f6` / `#ffffff` | `#111d19` / `#18271f` | Page / surfaces                                                                                                         |
| Opeka         | `#a12a1f`             | `#f0a39b`             | Destructive, errors                                                                                                     |

- Components use semantic tokens only (`--color-text`, `--color-action`, …).
  Raw hex is allowed only above `/* ---- END TOKENS ---- */`; `tests/contrast.test.ts`
  enforces this and checks every pairing at 4.5:1 (text) / 3:1 (UI) in both modes.
- Dark mode follows `prefers-color-scheme`; there is no manual toggle.
- Status is always a word (plus an icon where useful), never colour alone.

## Type

- **Bricolage Grotesque** (variable, `opsz` + `wdth`): headings, prices, brand.
- **Figtree**: body and UI.
- Both via `next/font/google` (self-hosted at build), `latin` + `latin-ext`.
- Scale 1.25: 12 (labels only) / 13 / 14 / 16 / 20 / 25 / 31 / 39 px. Body 16px, leading 1.5.
- Sentence case everywhere. No all-caps eyebrows; no arrow glyphs appended to links.

## Shape, depth, space

- Radius encodes hierarchy: `--radius-paper` 4px (flyers, chips, strips),
  `--radius-control` 8px (buttons, inputs), `--radius-media` 14px (photos, panels,
  sheets), `--radius-pill` (status badges, avatars).
- Cards have no shadow; a 1px border separates them. `--shadow-float` is only for
  floating layers (toast, sheet, sticky bars).
- Spacing: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64.

## Interaction

- Touch targets at least 44×44 (`--touch-min`).
- Global `:focus-visible` 3px outline in `--color-focus`; never remove outlines.
- Motion: 150–220ms colour/transform transitions on user action only; no scroll
  reveals, no hover lift. Everything collapses under `prefers-reduced-motion`.
- Icons: inline SVG from `components/icons.tsx` (Lucide paths), `aria-hidden`
  by default; the control carries the accessible name. No emoji or glyph icons.

## Browser support (browserslist: Chrome 64, Safari 12)

- No `@layer`, `:has()`, container queries, `inset`, or `aspect-ratio` without a fallback.
- `env()` and `min()` always follow a plain fallback declaration.
- Known degradation: flex `gap` (Chrome 84 / Safari 14.1) collapses to no gap
  in older browsers; layouts stay usable.
