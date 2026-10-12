// Keep in sync with PRIVATE_PREFIXES in lib/seo.ts (checked by tests/seo.test.ts).
const privatePrefixes = [
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
];

/** Privacy headers for every response. */
const securityHeaders = [
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      ...privatePrefixes
        .flatMap((prefix) => [prefix, `${prefix}/:path*`])
        .map((source) => ({
          source,
          headers: [
            { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          ],
        })),
    ];
  },
};

export default nextConfig;
