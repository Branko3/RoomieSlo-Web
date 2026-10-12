# Mobile, tablet, and desktop workflow coverage

- Status: Partially implemented
- Date: 2026-10-11
- Web surfaces:
  - `e2e/viewports.ts` (viewport matrix, page list, target size);
  - `e2e/responsive.spec.ts`;
  - `tests/viewport-matrix.test.ts`.
  - No application code changes.
- Android behavior preserved: not applicable. This feature is about responsive web layout.

## Behavior

- **Viewport matrix:** mobile 390×844 (touch), tablet 820×1180 (touch) and desktop 1440×900, one on each side of the `globals.css` breakpoints (650px and 900px).
- **Automated checks per viewport, 33 Playwright tests in total, run on Chromium with viewport emulation:**
  - All eight top-level pages show their heading with no horizontal overflow: listings, search, chats, favorites, profile, login, register and the 404 page.
  - Only the navigation for that size is visible: the bottom bar on mobile, the sidebar on tablet and desktop.
  - Navigation works through the visible navigation and marks the active section.
  - Search filters are usable and written to the URL without overflow.
  - Mobile:
    - all five bottom-bar links meet the WCAG 2.2 AA 24×24px target size;
    - content scrolled to the bottom is never covered by the fixed bar.
  - Tablet: the narrowed sidebar never overlaps the content.
- **Guard rails (Vitest, run with `npm run test`):**
  - the matrix stays in line with the CSS breakpoints;
  - the mobile block hides the sidebar and shows the bottom bar;
  - every top-level route under `app/` is in the page list, so a new page can't skip responsive coverage.

## Acceptance criteria

- [x] Automated workflow checks for mobile, tablet and desktop widths.
- [x] Layout regressions (overflow, wrong navigation, covered content, small touch targets) are asserted.
- [x] The viewport matrix can't drift from the CSS breakpoints or miss a page.
- [ ] Executed in a browser (blocked: Chromium not installed, and no dev server started).
- [ ] Real-device and WebKit (Safari) or Firefox checks. Those are part of "Performance and cross-browser checks".

## Implementation

- `e2e/responsive.spec.ts` loops over `VIEWPORTS` with `test.use({ viewport, hasTouch })`, so the matrix runs inside the existing `unauthenticated` project without changing `playwright.config.ts`.
- Overflow is measured as `scrollWidth - clientWidth` on the scrolling element, with 1px tolerance.

## Testing contract

- Unit: `tests/viewport-matrix.test.ts` (5 tests).
- End-to-end: `e2e/responsive.spec.ts` (33 tests).
- Manual: spot-check on a real phone and tablet before release.

## Handoff to testing

Run `npx playwright install chromium`, then `npx playwright test e2e/responsive.spec.ts`, and adjust if any page shows real overflow. Real overflow would be an application bug to fix.

## Test status

- Automated status: Partially covered
- Test files: `tests/viewport-matrix.test.ts` (5 tests, passing with `npm run test`); `e2e/responsive.spec.ts` (33 tests, collected by `playwright test --list`, not executed)
- Scenarios covered: the matrix and CSS consistency. The layout checks are written but not run.
- Remaining gaps: no browser run; no real devices; Chromium only.
- Manual testing: Not run unless explicitly requested
