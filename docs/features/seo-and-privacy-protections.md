# SEO and privacy protections

- Status: Partially implemented
- Date: 2026-10-12
- Web surfaces:
  - `lib/seo.ts` and `app/robots.ts`;
  - `next.config.mjs` (headers), with `next.config.d.mts` (types for tests);
  - `app/layout.tsx` metadata, and the new `app/login/layout.tsx` and `app/register/layout.tsx`.
- Android behavior preserved: not applicable. This covers web indexing and response headers only.

## Behavior

- **Indexing policy:** every app section shows signed-in users' data (RLS limits all tables to `authenticated`), so only `/login` and `/register` may be indexed.
  - `/robots.txt` allows `/login` and `/register` and disallows `/listings`, `/search`, `/chats`, `/favorites`, `/profile`, `/admin` and `/report`. `host` is added when `NEXT_PUBLIC_SITE_URL` is set.
  - `X-Robots-Tag: noindex, nofollow, noarchive` is sent on every private route and its sub-routes. This covers crawlers that ignore `robots.txt` but follow a link.
  - Page metadata is private by default: the root layout sets `robots: noindex, nofollow`, and the login and registration layouts opt back in.
  - Phone numbers, emails and addresses are not auto-linked (`formatDetection`).
- **Privacy headers on every response:**
  - `Referrer-Policy: strict-origin-when-cross-origin`, so URLs containing listing, chat or user ids don't leak to other sites;
  - `X-Content-Type-Options: nosniff`;
  - `X-Frame-Options: DENY` (no framing or clickjacking);
  - `Permissions-Policy` turns off camera, microphone, geolocation and FLoC;
  - no `X-Powered-By`.

## Acceptance criteria

- [x] A `noindex` policy for authenticated data, enforced three ways (robots.txt, `X-Robots-Tag`, metadata).
- [x] Public pages are explicitly allowed; every top-level route must have an indexing decision (tested).
- [x] Privacy-protecting response headers.
- [ ] Verified on a deployed environment, by `curl -I` and a search-console robots check (blocked: no deployment).
- [ ] A Content-Security-Policy. Left out because it needs the Supabase URL and a nonce strategy for Next.js scripts, and a wrong CSP breaks the app silently. It should be a follow-up once an environment exists.
- [ ] Privacy notice and cookie/storage disclosure (the favorites prototype uses `localStorage`). These are content and legal work, tracked with "Account deletion and operational privacy procedures".

## Implementation

- `lib/seo.ts`: `PUBLIC_PATHS`, `PRIVATE_PREFIXES`, `NOINDEX`, `isPrivatePath` (exact segment match, so `/listingsx` is public) and `robotsPolicy`.
- `next.config.mjs` repeats the private prefix list, because it can't import TypeScript. The test fails if the two lists differ.

## Testing contract

- **Unit (`tests/seo.test.ts`, 13 tests):**
  - private and public path classification, including look-alike paths;
  - robots rules and the optional host, and that `app/robots.ts` serves them;
  - every top-level route has an indexing decision;
  - `X-Robots-Tag` is sent for exactly the private prefixes;
  - the privacy headers and `poweredByHeader: false`;
  - private-by-default metadata, with the public opt-ins.
- Integration: `curl -I` on a deployment for `/listings` (expect `X-Robots-Tag`) and `/login` (expect none).
- End-to-end: none.
- Manual: a search-console robots.txt test after deployment.

## Handoff to testing

After the first deployment, check the headers with `curl -I` and fetch `/robots.txt`.

## Test status

- Automated status: Partially covered
- Test files: `tests/seo.test.ts`
- Scenarios covered: all unit scenarios. `npm run build` also generates `/robots.txt`.
- Remaining gaps: no deployed-header check; no CSP.
- Manual testing: Not run unless explicitly requested
