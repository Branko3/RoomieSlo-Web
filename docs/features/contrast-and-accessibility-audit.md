# Contrast and accessibility audit

- Status: Partially implemented
- Date: 2026-10-12
- Web surfaces:
  - `app/globals.css` (color fixes);
  - `lib/a11y/contrast.ts`, `tests/contrast.test.ts`, `e2e/accessibility.spec.ts`;
  - the `@axe-core/playwright` dev dependency.
- Android behavior preserved: not applicable. These are web color and accessibility rules; the brand greens are unchanged.

## Audit findings and fixes

WCAG 2.2 AA: 4.5:1 for normal text, and 3:1 for large text, UI components and focus indicators.

| Finding                                                                    | Before            | After                                                                                     |
| -------------------------------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------- |
| Secondary text `--muted` (used across all pages) on page and card surfaces | 3.96–4.15:1       | `#5a6963`, at least 4.5:1 on every light surface, including the listing image gradient    |
| Sidebar link text `.nav-link`                                              | `#7a8983`, 3.49:1 | `var(--muted)`                                                                            |
| Focus outline (amber) against light surfaces, 1.4.11                       | 1.85:1            | new `--focus-ring` (`#1d5143`), 8.7:1 or more; white inside the green hero banner (5.9:1) |
| Hero banner paragraph on green                                             | 4.49:1            | `#e0f2ea`, 5.08:1                                                                         |
| Hero banner eyebrow on green                                               | 4.10:1            | `#dcf0e7`, 4.97:1                                                                         |
| Favorite hearts (UI icons) on light surfaces                               | 2.92–3.05:1       | `#c25555`, 4.2:1 or more                                                                  |

Not changed: the decorative notification dot (no information on its own), and the amber action icon (3.75:1, which meets the 3:1 UI threshold).

## Behavior

- `npm run test` now enforces contrast on the design tokens:
  - ink, muted, green-dark and the focus ring on every light surface;
  - button text, active navigation, the hero texts and focus ring, sidebar links and hearts;
  - the focus indicator uses the new token, and the old low-contrast values can't return.
- `e2e/accessibility.spec.ts` runs an axe-core WCAG 2.0–2.2 A/AA scan on all eight top-level pages and checks `lang="sl"`.

## Acceptance criteria

- [x] Contrast audit of the design tokens and component colors, with failures fixed.
- [x] Automated contrast checks that run in `npm run test`.
- [x] An automated axe-core A/AA scan per page (Playwright).
- [ ] The axe scan executed (blocked: Chromium not installed, and no dev server started).
- [ ] A manual audit with assistive technology (screen reader, 200% zoom, reduced motion).

## Implementation

- `lib/a11y/contrast.ts`: `parseHex`, `luminance`, `contrastRatio` (the WCAG formula), `MIN_RATIO`, `readTokens`, `resolveColor`.
- `tests/contrast.test.ts` (32 tests): the formula against known values, color parsing and resolution, the token pair table read directly from `globals.css`, the focus-ring rule, and a ban on the old colors.
- `e2e/accessibility.spec.ts` (9 tests) uses `@axe-core/playwright@4.10.1` with the `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` and `wcag22aa` tags, and lists violation ids and targets on failure.

## Testing contract

- Unit: `tests/contrast.test.ts`.
- End-to-end: `e2e/accessibility.spec.ts`.
- Manual: NVDA or VoiceOver pass, 200% zoom and reflow, Windows high-contrast mode.

## Handoff to testing

Install Chromium, then run `npx playwright test e2e/accessibility.spec.ts`. Fix any violations it reports, which will be real issues, and add pages from merged feature PRs to its list.

## Test status

- Automated status: Partially covered
- Test files: `tests/contrast.test.ts` (32 tests, passing with `npm run test`); `e2e/accessibility.spec.ts` (9 tests, collected, not executed)
- Scenarios covered: all contrast checks. The axe scans are written but not run.
- Remaining gaps: no browser run; no assistive-technology audit; pages from open PRs are not scanned.
- Manual testing: Not run unless explicitly requested
