# RoomieSlo Web - Phase 1 Implementation Plan

Target workspace:

`C:\Users\brank\OneDrive\Desktop\Diploma\Za Razvoj\RoomieSlo-Web`

The web application is a separate sibling project. The existing Android project remains in `RoomieSlo-App` and continues to use the shared Supabase backend.

## Phase 1 scope

Phase 1 establishes the web foundation:

- Next.js and TypeScript application scaffolding.
- Supabase browser client and session restoration.
- Shared responsive layout and navigation.
- Authenticated and unauthenticated route handling.
- Reusable loading, empty, error, offline, and permission-denied states.
- Error boundaries and global fallbacks.
- TanStack Query provider.
- Vitest, Playwright, linting, formatting, type checking, and CI.

Feature-specific implementation such as listings, profiles, questionnaire flows, matching, chat, and offline listing caching belongs to later phases.

## 1. Create the project boundary

Create a standalone Next.js application directly in `RoomieSlo-Web`, rather than creating `RoomieSlo-Web/web`.

Recommended initial structure:

```text
RoomieSlo-Web/
  app/
    layout.tsx
    page.tsx
    error.tsx
    global-error.tsx
    loading.tsx
    not-found.tsx
    (auth)/
      login/
      register/
    (protected)/
      listings/
  components/
    layout/
    navigation/
    states/
    ui/
  features/
    auth/
  lib/
    supabase/
    auth/
    config/
  types/
  tests/
  public/
  .env.example
  eslint.config.*
  next.config.*
  package.json
  playwright.config.ts
  prettier.config.*
  tsconfig.json
  vitest.config.ts
```

## 2. Scaffold the Next.js application

Use:

- Next.js App Router.
- React and TypeScript.
- TypeScript strict mode.
- ESLint.
- Prettier.
- A token-based responsive CSS approach using CSS Modules and/or global CSS.

The initial page should provide a minimal landing/auth entry point and establish the application shell. Do not add a full UI component library unless it is needed by the selected design system.

## 3. Configure environment variables

Add an untracked local environment file and a committed template:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Only the public Supabase URL and anon key may be exposed to the browser. Never add a service-role key, database password, Storage secret, or other server credential.

Create a typed configuration helper that:

- Reads both required variables.
- Fails explicitly when either variable is missing.
- Does not silently create a client with empty credentials.
- Keeps browser-safe configuration separate from any future server-only configuration.

The web project should have its own environment configuration and must not depend on Android `local.properties`.

## 4. Add Supabase browser integration

Install and configure `@supabase/supabase-js`.

The initial integration should provide:

- A reusable browser Supabase client.
- Auth session retrieval.
- Auth state change subscription.
- Session restoration after refresh.
- Sign-out propagation.
- Subscription cleanup.

Keep this integration under `lib/supabase/` so feature code does not duplicate client setup.

The web client must remain compatible with the existing Supabase tables:

- `profiles`
- `questionnaire_answers`
- `listings`
- `matches`
- `messages`
- `favorites`
- `reports`
- `admins`

Phase 1 does not need to implement queries for all tables, but it should establish where TypeScript database types will live.

## 5. Add route groups and guards

Set up route groups for:

```text
app/
  (auth)/
    login/
    register/
  (protected)/
    listings/
```

Required behavior:

- Unauthenticated users may access public and auth routes.
- Unauthenticated users visiting protected routes are redirected to `/login`.
- Authenticated users visiting `/login` or `/register` are redirected to the protected entry route.
- Refreshing a protected route restores the existing session.
- Expired or invalid sessions become signed-out state.
- Auth loading prevents premature redirects before session restoration finishes.

These guards are for application UX. Supabase Row Level Security remains the authorization boundary.

## 6. Build the responsive application shell

Create a shared layout with:

- Persistent desktop navigation.
- Compact, touch-friendly mobile navigation.
- Responsive content container.
- Header/top bar.
- Main content landmark.
- Skip-to-content link.
- Accessible labels.
- Visible focus states.

Define tokens for:

- Colors and semantic statuses.
- Typography.
- Spacing.
- Border radius.
- Shadows.
- Breakpoints.
- Focus rings.
- Content width.

Use wider list/detail layouts on desktop and stacked content with compact navigation on mobile. The shell should remain usable when feature data is unavailable.

## 7. Add reusable application states

Create composable shared components for:

- Loading.
- Empty results.
- Error.
- Offline.
- Permission denied.
- Authentication required.
- Retry actions.
- Skeleton content where useful.

Requirements:

- Errors are visible and actionable.
- Permission denied is distinct from signed-out state.
- Offline state is not presented as successful loading.
- Empty results are distinct from loading and failure.
- Retry actions are keyboard accessible.

These states should be generic enough to support listings, profiles, chat, and administration later.

## 8. Configure TanStack Query

Add a root `QueryClient` and provider.

Configure explicitly:

- Browser query client creation.
- Reasonable retry behavior.
- Refetch-on-focus behavior.
- Reconnect behavior.
- A location for future query keys.

Do not implement IndexedDB or listing caching in Phase 1. Cache behavior belongs to Phase 3.

## 9. Add error and loading boundaries

Implement:

- Route-level `error.tsx`.
- Global `global-error.tsx`.
- `not-found.tsx`.
- Loading boundaries where appropriate.

Fallbacks should:

- Offer a useful recovery action.
- Avoid exposing tokens, stack traces, or Supabase internals.
- Log diagnostic context without logging passwords, sessions, document contents, or service credentials.
- Preserve a path to navigation and sign-out recovery.

## 10. Configure Vitest and Playwright

### Vitest

Add unit test coverage for:

- Environment/configuration validation.
- Auth-state helper behavior.
- Route guard decisions.
- Shared application-state components.
- Responsive navigation accessibility where practical.

The test setup should also be ready for the TypeScript compatibility utility planned in Phase 2.

### Playwright

Configure desktop and mobile viewport projects.

Initial smoke tests should verify:

1. The application loads at desktop width.
2. The application loads at mobile width.
3. An unauthenticated protected-route visit redirects to `/login`.
4. An authenticated session survives page refresh.
5. Authenticated users are redirected away from login/register routes.
6. Navigation links are exposed and keyboard accessible.

Use a dedicated development/staging Supabase project or controlled test mocks. Do not run destructive tests against production data.

## 11. Configure quality checks

Add scripts for:

```text
npm run dev
npm run build
npm run start
npm run lint
npm run format
npm run format:check
npm run typecheck
npm run test
npm run test:e2e
```

The quality gate should include:

- ESLint.
- Prettier check.
- TypeScript check.
- Vitest.
- Production build.
- Playwright smoke tests when test infrastructure is available.

## 12. Add CI

Create a GitHub Actions workflow in `RoomieSlo-Web` for pull requests and pushes to the default branch.

Recommended order:

1. Install dependencies from the lockfile.
2. Run lint.
3. Run the formatting check.
4. Run type checking.
5. Run Vitest.
6. Build the Next.js application.
7. Run Playwright smoke tests when staging credentials or a test environment are configured.

CI needs only the public URL and anon key for the test Supabase environment. It must not require a service-role key.

## 13. Backend readiness checks

Before considering Phase 1 complete, verify that the selected development/staging Supabase environment supports:

- Email/password authentication.
- Browser access using the anon key.
- Session restoration.
- Existing RLS policies.
- Denied access for unauthenticated requests.
- Private academic-document Storage policies.
- Separation from production.

Schema migration, environment separation, RLS review, and Storage negative-access tests are Phase 0/backend preparation work, but the web foundation depends on a usable test environment.

## 14. Implementation sequence

1. Create the Next.js project in `RoomieSlo-Web`.
2. Add environment configuration and typed Supabase setup.
3. Add the root layout, design tokens, responsive shell, and navigation.
4. Add auth loading and session context.
5. Add public and protected route groups.
6. Add redirect and auth error handling.
7. Add reusable loading, empty, error, offline, and denied states.
8. Add the TanStack Query provider.
9. Add error boundaries and not-found handling.
10. Configure Vitest and Playwright.
11. Add unit and browser smoke tests.
12. Add formatting, type-check, build, and CI scripts.
13. Validate desktop and mobile viewport behavior.
14. Record evidence for the Phase 1 exit criteria.

## Phase 1 exit criteria

Phase 1 is complete when:

- The application runs from `RoomieSlo-Web`.
- Production build succeeds.
- Desktop and mobile viewport layouts render correctly.
- Supabase sessions survive refresh.
- Authenticated users reach the protected shell.
- Unauthenticated users are redirected from protected routes.
- Authenticated users are redirected away from login/register routes.
- Loading, empty, error, offline, and permission-denied states are reusable.
- No service-role key or other secret is exposed to the browser.
- Linting, formatting, type checking, unit tests, and Playwright smoke tests pass.
- CI validates the web project independently of the Android Gradle build.

Completion of this foundation enables the recommended vertical slice: authentication followed by an authenticated paginated listings feed and responsive listing detail page.
