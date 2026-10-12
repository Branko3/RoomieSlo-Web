import { devices } from "@playwright/test";

/**
 * Opt-in browser projects for cross-browser runs. Chromium always runs; set
 * E2E_BROWSERS (comma-separated) to add others, e.g.
 * `E2E_BROWSERS=firefox,webkit npm run test:e2e` after
 * `npx playwright install firefox webkit`.
 */
export const BROWSER_PROJECTS = {
  firefox: devices["Desktop Firefox"],
  webkit: devices["Desktop Safari"],
  "mobile-chrome": devices["Pixel 7"],
  "mobile-safari": devices["iPhone 14"],
} as const;

export type BrowserName = keyof typeof BROWSER_PROJECTS;

export function parseBrowsers(value: string | undefined): BrowserName[] {
  const names = (value ?? "")
    .split(",")
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);
  const unknown = names.filter((name) => !(name in BROWSER_PROJECTS));
  if (unknown.length) {
    throw new Error(
      `Unknown E2E_BROWSERS entries: ${unknown.join(", ")}. Use ${Object.keys(BROWSER_PROJECTS).join(", ")}.`,
    );
  }
  return [...new Set(names)] as BrowserName[];
}

export type BrowserProject = {
  name: BrowserName;
  use: (typeof BROWSER_PROJECTS)[BrowserName];
};

export function crossBrowserProjects(
  value: string | undefined,
): BrowserProject[] {
  return parseBrowsers(value).map((name) => ({
    name,
    use: { ...BROWSER_PROJECTS[name] },
  }));
}
