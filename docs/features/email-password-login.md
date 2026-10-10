# Email/password login

- Status: Implemented
- Date: 2026-10-10
- Web surfaces: `/login`, shared `AuthProvider`, protected `AppShell`, `/profile` logout
- Android behavior preserved: Existing Supabase Auth email/password accounts are used unchanged; authentication failures do not alter user data, and session state remains authoritative for protected workflows and RLS.

## Behavior

`/login` validates the email and password locally before calling the shared browser Supabase client. A valid submission calls `signInWithPassword`, disables the form while pending, maps authentication/network failures to safe Slovenian messages, and redirects to a safe requested path or `/listings`. Signed-in users are redirected away from login. The shared provider restores the browser-persisted session with `getSession`, listens for Supabase auth state changes, and gates the application shell until that state is known. Profile logout uses the same provider and returns to login.

## Acceptance criteria

- [x] Accessible labeled email/password fields, autocomplete attributes, submit control, and live form error region.
- [x] Empty or malformed email and empty password are rejected before an Auth request.
- [x] Browser Supabase `signInWithPassword` is used without an application API or service-role credentials.
- [x] Pending submission prevents duplicate requests and communicates progress.
- [x] Safe requested-route/default redirects and signed-in login redirect are implemented.
- [x] Auth errors are localized and do not expose raw credentials or misleading success state.
- [x] Shared session state reacts to initial restoration and sign-in/sign-out events.
- [x] Protected content is not rendered while session state is unresolved or unauthenticated.

## Implementation

`components/auth-provider.tsx` owns the single browser client session integration point and exposes session, loading, errors, sign-in, and sign-out to the layout and route boundary. `components/app-shell.tsx` guards all non-auth routes and preserves the current pathname/query in a safe `next` value. `app/login/page.tsx` contains the accessible client form and validation. Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are consumed by `lib/supabase/browser.ts`; no schema or Auth account migration was added.

## Testing contract

- Unit: Validation, safe redirect selection, error mapping, duplicate-submit prevention, and auth-provider session-change behavior should be covered at the feature boundary with mocked browser Supabase.
- Integration/security: Staging coverage is required for successful existing-user login, invalid credentials, expired sessions, protected-route denial/access, and service-role absence.
- End-to-end: Playwright should cover login validation, keyboard/focus behavior, safe requested-route redirect, authenticated-login redirect, and mobile/tablet/desktop layouts.
- Manual: Verify with a staging account, including an unconfirmed account and network interruption.

## Handoff to testing

Add mocked browser-client tests for `signInWithPassword` arguments, no duplicate calls while pending, invalid credentials/network-safe messages, and `onAuthStateChange` transitions. Run the authenticated Playwright project against staging to verify `/login?next=/listings?...`, an already signed-in visit to `/login`, logout from `/profile`, refresh persistence, and denial before session confirmation. Staging credentials and installed Playwright browsers are not configured in this worktree, so those checks remain gaps.

## Automated status

- Status: Automated local checks passed; staging/browser checks pending
- Test files: `components/auth-provider.tsx`, `app/login/page.tsx`, `components/app-shell.tsx`; feature-specific Vitest/Playwright coverage is not yet present.
- Commands/results: `npm run typecheck` passed; `npm run lint` passed with no warnings; `npm test -- --run` passed (3 files, 16 tests); `npm run build` passed and generated all 11 routes.
- Remaining gaps: No staging Supabase credentials or browser binary are available for authenticated integration and Playwright verification.
