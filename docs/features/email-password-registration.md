# Email/password registration

- Status: Implemented
- Date: 2026-10-10
- Web surfaces: `/register`, existing `/login` link
- Android behavior preserved: Email/password account creation captures the display name as Auth metadata; confirmation-required responses remain pending confirmation rather than being presented as authenticated.

## Behavior

Unauthenticated visitors can submit a display name, email, and password. Name and email are trimmed (email is lowercased), client validation prevents invalid requests, and Supabase Auth receives `options.data.display_name`. The existing `handle_new_user` trigger remains responsible for creating the profile. Success with no session explains email confirmation and links to `/login`; duplicate and unexpected failures use safe Slovenian messages.

## Acceptance criteria

- [x] Labeled, keyboard-accessible controls and Slovenian feedback are present.
- [x] Required-field, email, and minimum-password validation is associated with controls.
- [x] Supabase `signUp` receives normalized credentials and `display_name` metadata.
- [x] Pending submission is protected against duplicate clicks and exposes loading text.
- [x] Confirmation-required, duplicate-email, and generic failure states are handled without sensitive output.
- [x] No client-side profile insert or private credential is added.
- [ ] Staging Auth and email delivery integration check (blocked by unavailable staging credentials).

## Implementation

`lib/auth/registration.ts` contains pure normalization, validation, and safe Auth error mapping. `app/register/page.tsx` uses the public browser client only and does not implement login, session restoration, guards, or profile insertion. The existing SQL trigger in `supabase/migrations/20261007000000_android_baseline.sql` copies `raw_user_meta_data.display_name` into `profiles.display_name`.

## Testing contract

- Unit: `tests/registration.test.ts` covers trimming, email normalization/validation, required fields, password length, and safe error mapping.
- Integration/security: Requires a configured staging Supabase project to prove Auth creation and trigger persistence; no service-role key is used or needed in browser tests.
- End-to-end: Playwright `/register` workflow should mock the Auth boundary for validation, pending, confirmation, duplicate, generic error, accessibility, and login-link scenarios.
- Manual: Verify confirmation email delivery and profile display name in staging when credentials and mail delivery are available.

Validation on 2026-10-10: `npm run typecheck` passed, `npm run lint` passed, targeted Prettier checks passed, and `npm run test` passed (20 tests). Repository-wide `npm run format:check` remains non-zero because numerous pre-existing files are not formatted. `npm run test:e2e` discovered 14 tests, skipped 12 staging-gated scenarios, and could not launch the two local scenarios because Playwright Chromium is not installed. Staging Auth/email delivery is not configured.

## Handoff to testing

Assert the exact `signUp` payload (`email`, `password`, and `options.data.display_name`), no call for invalid input, disabled submit while pending, confirmation copy containing the normalized email, duplicate/generic safe messages, error association and status announcements, keyboard focus on the first invalid control, and the `/login` link.

## Test status

- Automated status: Partially covered
- Test files: `tests/registration.test.ts`, `e2e/register.spec.ts`
- Scenarios covered: Unit coverage for normalization, validation, exact sign-up payload construction, and safe error mapping; Playwright coverage for accessible controls, validation associations, invalid-submit protection and focus, exact mocked Auth payload, pending duplicate-click protection, confirmation copy, duplicate/generic safe messages, status announcements, and the `/login` link.
- Test results: `npm test` passed (20 tests); `npm run typecheck` passed; targeted Prettier check passed after formatting; `npm run test:e2e -- e2e/register.spec.ts` discovered 5 tests but all were blocked before execution because the configured Chromium browser is not installed.
- Remaining gaps: Playwright behavior is covered in source but not executed in this environment; staging Auth-trigger persistence and email delivery remain blocked by unavailable staging credentials. Manual testing was not run.
