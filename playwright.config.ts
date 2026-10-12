import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";

// Agent worktrees (where .git is a file) run in parallel, so each derives its
// own dev-server port instead of sharing and reusing a server on port 3000.
function devServerPort(): number {
  if (process.env.E2E_PORT) return Number(process.env.E2E_PORT);
  if (!fs.existsSync(".git") || !fs.statSync(".git").isFile()) return 3000;
  let hash = 0;
  for (const char of process.cwd())
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return 3100 + (hash % 800);
}

const port = devServerPort();
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${port}`;
const authState = process.env.E2E_AUTH_STATE;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run dev -- --port ${port}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
  projects: [
    {
      name: "unauthenticated",
      use: { ...devices["Desktop Chrome"] },
    },
    ...(authState && fs.existsSync(authState)
      ? [
          {
            name: "authenticated",
            use: {
              ...devices["Desktop Chrome"],
              storageState: authState,
            },
          },
        ]
      : []),
  ],
});
