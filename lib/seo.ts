import type { MetadataRoute } from "next";

/**
 * Indexing policy. Every app section shows signed-in users' data (RLS limits
 * all tables to `authenticated`), so only the sign-in and registration pages
 * may be indexed. `next.config.mjs` sends `X-Robots-Tag: noindex` for the same
 * private prefixes; `tests/seo.test.ts` keeps the two lists in sync.
 */
export const PUBLIC_PATHS = ["/login", "/register"] as const;

export const PRIVATE_PREFIXES = [
  "/listings",
  "/search",
  "/chats",
  "/favorites",
  "/profile",
  "/admin",
  "/report",
  "/recommendations",
  "/academic-verification",
  // E-mail confirmation links and auth errors carry tokens or session state.
  "/auth",
  "/auth-error",
] as const;

export const NOINDEX = "noindex, nofollow, noarchive";

/** True for any path under a private prefix (exact segment match). */
export function isPrivatePath(pathname: string): boolean {
  const path = pathname.split(/[?#]/)[0];
  return PRIVATE_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

export function robotsPolicy(siteUrl?: string): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: [...PUBLIC_PATHS],
      disallow: [...PRIVATE_PREFIXES],
    },
    ...(siteUrl ? { host: siteUrl.replace(/\/+$/, "") } : {}),
  };
}
