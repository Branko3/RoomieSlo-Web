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
  "/api",
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
  webpack(config, { isServer }) {
    const splitChunks = config.optimization?.splitChunks;
    if (!isServer && splitChunks) {
      // The i18n runtime (provider, formatters, switcher) is used by the root
      // layout and by most pages. Small shared modules are otherwise copied
      // into every page chunk, so each page would pay for it a second time
      // in its first-load JavaScript (perf-budget.json).
      splitChunks.cacheGroups = {
        ...splitChunks.cacheGroups,
        i18n: {
          // App code only (Next has its own shared/lib/i18n), never the catalogs.
          test: (module) =>
            !/[\\/]node_modules[\\/]/.test(module.resource ?? "") &&
            /[\\/](lib[\\/]i18n[\\/](?!messages[\\/])|components[\\/]language-switcher)/.test(
              module.resource ?? "",
            ),
          name: "i18n",
          chunks: "all",
          enforce: true,
          priority: 50,
        },
      };
    }
    return config;
  },
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
