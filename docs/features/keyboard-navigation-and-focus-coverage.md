# Keyboard navigation and focus coverage

- Status: Partially implemented
- Date: 2026-10-11
- Web surfaces:
  - `app/chats/page.tsx` and `app/profile/page.tsx` (fixes);
  - `tests/keyboard-static.test.ts`;
  - `e2e/keyboard.spec.ts`.
- Android behavior preserved: not applicable. This is web keyboard and focus behavior; TalkBack is out of scope.

## Behavior

- **Fixes:**
  - The icon-only "⋯" button on `/chats` and "⚙" button on `/profile` had no accessible name, so screen readers announced only a symbol. They are now "Več možnosti" and "Nastavitve profila", with `type="button"`.
  - The availability toggle on `/profile` now reports its state with `aria-pressed`, so on and off are announced.
- **Existing behavior now covered by tests:** the skip link is the first focus stop and jumps to `#main-content`, and `:focus-visible` draws a 3px amber outline.

## Acceptance criteria

- [x] A complete keyboard journey test exists (skip link → navigation → page controls, search filters, toggle, login form).
- [x] Every focus stop on every top-level page has a name and a visible outline (asserted per page).
- [x] Static guards stop the regressions most likely to slip back in.
- [ ] Executed in a browser (blocked: Chromium not installed, and no dev server started).
- [ ] Dead `href="#"` links ("Pozabljeno geslo?" on login, "Nadaljuj →" on profile) still take focus but go nowhere. They belong to the auth and questionnaire features in open PRs (#18–#22), which replace those pages, so they were left alone to avoid conflicts.

## Implementation

- **`tests/keyboard-static.test.ts`** (Vitest, 5 tests) checks that:
  - icon-only `<button>`s need `aria-label`; this would have caught both fixed buttons;
  - there is no positive `tabIndex`;
  - there are no `onClick` handlers on non-interactive elements;
  - the `:focus-visible` outline exists and no `outline: none/0` is used;
  - the skip link comes before the sidebar and targets `<main id="main-content">`.
- **`e2e/keyboard.spec.ts`** (Playwright, 13 tests):
  - the first Tab reaches the skip link, Enter jumps to the content, and the next Tab stays inside it;
  - sidebar links come in visual order and open with Enter;
  - on each of 7 pages, every focus stop has a name and an outline of at least 2px;
  - search location, budget (arrow keys) and sort work from the keyboard;
  - the toggle responds to Space and Enter and updates `aria-pressed`;
  - the login form can be filled and submitted without a mouse.

## Testing contract

- Unit: `tests/keyboard-static.test.ts`.
- End-to-end: `e2e/keyboard.spec.ts`.
- Manual: a screen-reader pass (NVDA or VoiceOver) before release.

## Handoff to testing

Install Chromium, then run `npx playwright test e2e/keyboard.spec.ts`. A failure on a focus stop with no name or outline is an application bug.

## Test status

- Automated status: Partially covered
- Test files: `tests/keyboard-static.test.ts` (5 tests, passing with `npm run test`); `e2e/keyboard.spec.ts` (13 tests, collected, not executed)
- Scenarios covered: the static rules. The keyboard journey is written but not run.
- Remaining gaps: no browser run; no screen-reader pass; dead `#` links pending the auth and questionnaire PRs.
- Manual testing: Not run unless explicitly requested
