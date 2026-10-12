# Profile loading and editing

- Status: Implemented
- Date: 2026-10-11
- Web surfaces: `/profile` header section, `components/own-profile-section.tsx`
- Android behavior preserved: the profile screen loads the signed-in user's `profiles` row and lets them edit their own name and profile details; verification status is read-only and availability is a separate control.

## Behavior

- With Supabase configured, `/profile` loads the current user (`auth.getUser()`) and their `profiles` row through TanStack Query (`["profile", "own"]`).
- States:
  - loading — "Nalaganje profila …" status,
  - signed out — "Nisi prijavljen" with a link to `/login`,
  - missing row — explains that the profile is not ready yet,
  - error — a safe message (permission, offline, or generic) and a "Poskusi znova" retry button,
  - ready — initials avatar, display name, faculty and age, the verified badge only when `academic_status_verified` is true, the bio, and an "Uredi" button.
- "Uredi" opens an inline form for name, faculty, age, and bio, prefilled from the current profile.
  - Validation rules:
    - name: trimmed, inner whitespace collapsed, 2–60 characters,
    - faculty: at most 120 characters,
    - age: empty or a whole number from 16 to 99,
    - bio: at most 500 characters, with a live counter.
  - Errors are shown per field with `aria-invalid`/`aria-describedby`, and the first invalid field is focused.
  - Saving disables the form and shows "Shranjevanje …". On success, the query cache is updated with the returned row, the form closes, and "Profil je shranjen." is announced. On failure, the form stays open with a safe alert.
  - "Prekliči" discards the draft.
- Without Supabase configuration the page keeps the existing preview header (prototype mode).

## Acceptance criteria

- [x] The signed-in user's own profile row loads with loading, signed-out, missing, and error states.
- [x] The user can edit display name, faculty, age, and bio with client-side validation.
- [x] Updates target only the user's own row and only editable fields (never `academic_status_verified` or `is_available`).
- [x] Saved changes appear immediately without a reload; failures keep the draft and show a safe message.
- [x] Permission and offline failures are distinguished from generic errors without exposing database details.
- [x] Prototype mode without Supabase is unchanged.
- [ ] Verified against real RLS and data in a browser (blocked: staging credentials and Playwright browsers).

## Implementation

- `lib/profile/own-profile.ts`:
  - `fetchOwnProfile`, `updateOwnProfile`, `validateProfileDraft`, `draftFromProfile`, `toProfileRequestError`, and `initialsFor`,
  - a structural `ProfileClient` type so the logic is tested without Supabase,
  - rows pass through the existing `mapProfile` validator.
- `updateOwnProfile` builds its payload explicitly from the four editable fields and uses `.eq("id", userId).select("*").maybeSingle()`. An empty result (row hidden by RLS) is treated as a permission error.
- `components/own-profile-section.tsx` — query, mutation, states, and form. `app/profile/page.tsx` renders it in place of the static header. Availability, questionnaire, and logout cards are unchanged.
- `app/globals.css` — form, field error/hint, bio, and `.error-message` styles (the same `.error-message` rule appears in PRs #18/#19; keep one when merging).
- **Security note:** the current `profiles_update` RLS policy (`auth.uid() = id`) does not restrict columns, so a user could still set `academic_status_verified` through the API directly. The client never sends it, but the boundary must be enforced in the database (column-level grants or a trigger). That belongs to the "RLS and Storage policy review" feature (PR #8) and is recorded there as a dependency.

## Testing contract

- Unit: query construction, signed-out/missing/ready results, error mapping (permission, offline, generic, auth server error, malformed row), editable-field-only updates, RLS-hidden update, validation rules and boundaries, normalization, draft and initials helpers.
- Integration: RLS — a user can read any profile but update only their own row; verification column must be protected (staging).
- End-to-end: load profile, edit and save, see updated header after reload; invalid input shows field errors; offline save shows the alert.
- Manual: none beyond the above.

## Handoff to testing

- `fetchOwnProfile`: ready result and query `from("profiles").select("*").eq("id", userId)`; signed-out without a profile query; missing row; `42501` → permission; `TypeError` → offline; auth 500 → error; malformed row → generic error.
- `updateOwnProfile`: exact four-field payload even when extra fields are passed; own-row filter; null data → permission; DB error → generic message without details.
- `validateProfileDraft`: normalization, optional fields, each invalid field, and the 2/60, 120, 500, and 16/99 boundaries.
- Component: loading, signed-out, missing, error with retry, edit/cancel, field errors and focus, pending state, success message.

## Test status

- Automated status: Partially covered
- Test files: `tests/own-profile.test.ts`
- Scenarios covered: all logic scenarios above (24 tests, passing with `npm run test`).
- Remaining gaps: component states, focus management, and the save flow in the UI are not component-tested (no React Testing Library/jsdom in the repo); no Playwright run (no installed browsers); RLS behavior needs a staging project; the column-level protection of `academic_status_verified` is not enforced in the database yet.
- Manual testing: Not run unless explicitly requested
