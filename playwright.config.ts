import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const authState = process.env.E2E_AUTH_STATE;

if (authState && !fs.existsSync(authState)) {
  throw new Error(
    `E2E_AUTH_STATE points to a missing file: ${authState}. ` +
      "Use disposable staging browser state or unset the variable.",
  );
}

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
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
  projects: [
    {
      name: "unauthenticated",
      use: { ...devices["Desktop Chrome"] },
    },
    ...(authState
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
