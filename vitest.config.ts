import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["node_modules", ".next"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "text"],
      // Application logic only: React hooks/components need a DOM test
      // environment, `types.ts` is declarations, and `data.ts` is preview data.
      include: ["lib/**/*.ts", "supabase/functions/_shared/**/*.ts"],
      exclude: [
        "lib/supabase/hooks.ts",
        // React hooks, the browser IndexedDB adapter, and the next/headers server client
        // need a browser or request context; their pure logic lives in tested modules.
        "lib/**/use-*.ts",
        "lib/listings/indexeddb-store.ts",
        "lib/supabase/server.ts",
        "lib/supabase/types.ts",
        "lib/data.ts",
      ],
      // Fail the coverage run if covered logic loses tests.
      thresholds: { statements: 95, lines: 95, functions: 95, branches: 80 },
    },
  },
});
