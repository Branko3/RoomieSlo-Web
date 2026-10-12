# Logout

- Status: Implemented
- Date: 2026-10-11
- Web surfaces: `/profile` ("Odjava" button), `components/logout-button.tsx`, `components/providers.tsx`
- Android behavior preserved: logout calls Supabase `signOut` with the local scope (the supabase-kt default), so only the current device is signed out, and the user returns to the login screen.

## Behavior

- The "Odjava" button on `/profile` signs the user out with `auth.signOut({ scope: "local" })`.
- While logging out, the button is disabled and shows "Odjavljanje …" so repeated clicks cannot start a second sign-out.
- After sign-out the app clears the TanStack Query cache, resets in-memory favorites, and removes every `roomieslo:`-prefixed localStorage key, so the next person using the browser does not see the previous user's data. Supabase-managed session storage is removed by Supabase itself.
- The user is then sent to `/login` with `router.replace` (Back does not return to the profile), and the router is refreshed.
- If Supabase returns an error from the server-side revoke, the stored session has already been removed by Supabase, so logout still completes.
- If sign-out throws unexpectedly, the user stays on the profile with a retryable alert "Odjava ni uspela. Preveri povezavo in poskusi znova." and no local data is cleared.
- Without Supabase configuration (prototype mode) the button clears local prototype data and goes to `/login`.

## Acceptance criteria

- [x] "Odjava" signs the user out of Supabase on this device only.
- [x] Cached server state, in-memory favorites, and app-owned local storage are cleared on logout.
- [x] The user is redirected to `/login` without a Back-navigation path to the profile.
- [x] A pending state prevents duplicate sign-out requests.
- [x] Server-side revoke errors still complete logout; unexpected failures show a retryable error and keep data intact.
- [x] Prototype mode without Supabase still works.
- [ ] Verified against a real Supabase session in a browser (blocked: needs staging credentials and Playwright browsers).

## Implementation

- `lib/auth/logout.ts` — `performLogout({ client, clearServerState, resetUserState, storage })` and `clearLocalUserData(storage)`; framework-independent and injected with the Supabase auth client.
- `components/logout-button.tsx` — client button that wires `performLogout` to `queryClient.clear()`, `resetFavorites()`, `window.localStorage`, and `useRouter`.
- `components/providers.tsx` — favorites context gains `resetFavorites()` (file reformatted by Prettier).
- `app/profile/page.tsx` — uses `LogoutButton`.
- `app/globals.css` — `.error-message` style (the same rule is added in PR #18; resolve as one rule when both land).
- After logout the favorites provider rewrites `roomieslo:favorites` as `[]`, which holds no user data.
- Related open work: the login PR (#16) and the session-restoration PR (#17) both edit the navigation/profile area; the session provider there will receive `SIGNED_OUT` from Supabase and update automatically.

## Testing contract

- Unit: local-scope sign-out, redirect target, clearing of query cache/user state/prefixed storage keys only, revoke-error completion, thrown-error retention, unconfigured mode, missing storage.
- Integration: real Supabase session removed after logout (staging).
- End-to-end: sign in, open `/profile`, click "Odjava", land on `/login`, Back does not show the profile, favorites are empty.
- Manual: none beyond the end-to-end flow.

## Handoff to testing

- `signOut` called once with `{ scope: "local" }`; result redirects to `/login`.
- Query cache cleared, favorites reset, `roomieslo:*` keys removed, non-app keys (including Supabase's own) untouched.
- `signOut` resolves with `{ error }` → still `ok`.
- `signOut` rejects → `{ ok: false, message }`, nothing cleared.
- No client → local data cleared, `ok`.
- `storage` null → no crash.
- Button: pending label and disabled state, alert on failure (component-level).

## Test status

- Automated status: Partially covered
- Test files: `tests/logout.test.ts`
- Scenarios covered: all logic scenarios above (7 tests, passing with `npm run test`).
- Remaining gaps: the button's pending/disabled/alert rendering and router redirect are not component-tested (no React Testing Library/jsdom in the repo); no Playwright run (no installed browsers); real Supabase sign-out needs staging credentials.
- Manual testing: Not run unless explicitly requested

## Merge note (2026-10-12)

`AuthProvider.signOut` (from #11/#16) now delegates to `performLogout`, so every logout path
(profile `LogoutButton` and the sidebar ↪ button) uses local scope and clears the query cache,
favorites and `roomieslo:` storage. `LogoutButton` calls `useAuth().signOut()`.
