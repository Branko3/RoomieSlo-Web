# Component test foundation

- Status: Implemented
- Date: 2026-10-13
- Web surfaces: test tooling only; first suites cover `components/message-composer.tsx` and `components/match-requests-panel.tsx`
- Android behavior preserved: not applicable (tests only)

## Behavior

Until now, every PR listed "not component-tested (no React Testing Library)" as a gap: components and hooks were covered only through extracted pure logic. This adds React Testing Library with jsdom so components can be rendered and driven like a user would.

- Only files in `tests/components/**/*.test.tsx` run in jsdom. All existing logic tests stay in Node and are unchanged.
- `tests/components/setup.ts` registers the `jest-dom` matchers and unmounts after each DOM test.
- Supabase is mocked at the same boundary as the logic tests (`createSupabaseBrowserClient`, `getSupabaseConfig`). No network, no credentials.

## Acceptance criteria

- [x] `npm test` runs component tests next to the existing suites, and CI picks them up with no workflow change.
- [x] Existing Node tests and the coverage thresholds are unaffected.
- [x] First suites cover the composer and the match request panel.

## Implementation

- devDependencies: `@testing-library/react`, `@testing-library/dom`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom`.
- `vitest.config.ts`: `esbuild.jsx = "automatic"` (Next keeps JSX as `preserve`), the `tests/components/**/*.test.tsx` include, `environmentMatchGlobs` for jsdom, and the setup file.
- `tests/components/message-composer.test.tsx`: Enter sends the trimmed text and clears the draft while keeping focus; Shift+Enter adds a line break; blank drafts can't be sent; an over-long draft is invalid and shows the counter; errors are announced.
- `tests/components/match-requests-panel.test.tsx`: answer buttons only on requests sent to me; "Odpri klepet" links to `/chats/<id>`; accepting calls the `accept_match` RPC and shows the new state; rejecting is a status-only update; a conflict shows an alert; the empty state.

## Testing contract

- Unit/component: as above (11 tests).
- Coverage: `npm run test:coverage` still measures `lib/` only, with the same thresholds.

## Handoff to testing

New component tests go in `tests/components/<component>.test.tsx`; mock `../../lib/supabase/browser` and `../../lib/config` as in `match-requests-panel.test.tsx`. Good next candidates: the listing request button, the delete-listing confirmation and the admin report list.

## Test status

- Automated status: Covered
- Test files: `tests/components/message-composer.test.tsx`, `tests/components/match-requests-panel.test.tsx`, `tests/components/setup.ts`
- Scenarios covered: listed above
- Remaining gaps: other components (see handoff)
- Manual testing: Not run unless explicitly requested
