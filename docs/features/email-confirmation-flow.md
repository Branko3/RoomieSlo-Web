# Email confirmation flow

- Status: Implemented
- Date: 2026-10-11
- Web surfaces: `/auth/confirm` (route handler), `/auth/confirmation` (page), `components/email-confirmation-panel.tsx`
- Android behavior preserved: a new account stays pending until the user opens the Supabase confirmation e-mail; only then can they sign in. The web flow uses the same Supabase Auth confirmation and does not treat an unconfirmed sign-up as authenticated.

## Behavior

- The confirmation e-mail links to `/auth/confirm`. The route accepts either a token-hash link (`token_hash` + `type` of `signup`, `email`, or `email_change`) or a PKCE `code`, verifies it with Supabase on the server, stores the session cookies, and redirects to `next` (default `/listings`).
- `next` is only honored for same-origin relative paths; absolute URLs, protocol-relative URLs, backslashes, and loops back to `/auth/confirm` fall back to `/listings`.
- Failures redirect to `/auth/confirmation?error=<reason>`:
  - `missing` — incomplete link,
  - `expired` — link expired (`otp_expired`),
  - `invalid` — already used, wrong type, or rejected by Supabase,
  - `unknown` — server/network failure or Supabase not configured.
    Each reason shows a Slovenian message without token or provider details.
- `/auth/confirmation` without an error shows "Preveri svojo e-pošto" (check your inbox). With or without an error it offers a resend form: the e-mail is trimmed and lowercased, validated before any request, and sent with `auth.resend({ type: "signup" })` and an `emailRedirectTo` pointing back at `/auth/confirm`.
- After a successful resend the button is disabled for 60 seconds with a countdown. The success message is the same whether or not the account exists (no account enumeration). Rate-limit (429), other errors, and network failures show safe messages.
- An `email` query parameter pre-fills the resend form (for the registration page to link with).

## Acceptance criteria

- [x] A valid token-hash confirmation link verifies the account and redirects to the requested page.
- [x] A PKCE `code` confirmation link is exchanged for a session.
- [x] Expired, invalid/used, incomplete, and failed confirmations show a specific, safe Slovenian message.
- [x] The redirect after confirmation can never leave the site.
- [x] The user can resend the confirmation e-mail with validation, a cooldown, rate-limit handling, and no account enumeration.
- [x] The flow works without exposing secrets; only the public anon key is used.
- [ ] The registration page sends `emailRedirectTo` and links to `/auth/confirmation?email=…` (depends on the open registration PR #15; `emailRedirectUrl()` is exported for it).
- [ ] The Supabase confirmation e-mail template points at `/auth/confirm` (project configuration; needs staging access).

## Implementation

- `lib/auth/confirmation.ts` — link parsing (`parseConfirmationParams`), `safeNextPath`, error classification and copy, `completeConfirmation(request, client)`, `emailRedirectUrl(origin, next)`, and `resendConfirmation(client, email, origin)`. All Supabase access goes through small structural client types so the logic is tested without a network.
- `lib/supabase/server.ts` — cookie-aware server client for route handlers (`createServerClient` + `next/headers` cookies); returns `null` when Supabase is not configured.
- `app/auth/confirm/route.ts` — GET handler; incomplete links never create a Supabase client.
- `app/auth/confirmation/page.tsx` + `components/email-confirmation-panel.tsx` — page with `Suspense` around the `useSearchParams` client panel.
- `app/globals.css` — `.error-message` style and labels inside the auth-card form.
- Supabase template setting (to apply in each environment): confirmation link `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/listings`.

## Testing contract

- Unit: link parsing, safe next path, error classification and copy, verification/exchange calls, resend payload, validation, rate limit, network failure, unconfigured Supabase.
- Integration: route handler redirects with a mocked server client; real confirmation against a staging project.
- End-to-end: open `/auth/confirmation?error=expired`, resend, see cooldown; follow a real confirmation e-mail link (needs staging + mail delivery).
- Manual: confirm e-mail template configuration in each Supabase environment.

## Handoff to testing

- `safeNextPath` for relative, empty, absolute, protocol-relative, backslash, non-slash, and `/auth/confirm` inputs.
- Token-hash, PKCE code, incomplete, wrong-type (`recovery`), and provider-error (`otp_expired`, `access_denied`) links.
- Verification success → `next`; expired → `expired`; 4xx → `invalid`; 5xx and thrown errors → `unknown`; no client → `unknown`; incomplete link makes no Supabase call.
- Route handler: 307 redirect to `next`, to the confirmation page on failure, never off-site, no client for incomplete links.
- Resend: invalid e-mail makes no call; normalized e-mail and `emailRedirectTo` payload; neutral success copy; 429, generic error, network failure, unconfigured.
- Panel: cooldown countdown and disabled button after success; error copy for each `error` query value.

## Test status

- Automated status: Partially covered
- Test files: `tests/email-confirmation.test.ts`, `tests/email-confirmation-route.test.ts`
- Scenarios covered: all logic and route-handler scenarios above (33 tests, all passing with `npm run test`).
- Remaining gaps: the panel's rendered states and 60-second cooldown are not component-tested (no React Testing Library/jsdom in the repo) and no Playwright run (no installed browsers); real confirmation against Supabase and the e-mail template need staging credentials and mail delivery; registration wiring waits for PR #15.
- Manual testing: Not run unless explicitly requested
