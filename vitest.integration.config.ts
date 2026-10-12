import { defineConfig } from "vitest/config";

// Opt-in suite against a disposable or staging Supabase project.
// Run with `npm run test:integration`; it skips itself without configuration.
export default defineConfig({
  test: {
    include: ["integration/**/*.int.ts"],
    exclude: ["node_modules", ".next"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
