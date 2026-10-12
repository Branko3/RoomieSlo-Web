import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { requireSignedIn } from "./env";

// Automated WCAG 2.2 A/AA scan with axe-core on every top-level page.
const PAGES = [
  "/listings",
  "/search",
  "/chats",
  "/favorites",
  "/profile",
  "/login",
  "/register",
  "/auth-error",
  "/privacy",
  "/recommendations",
  "/academic-verification",
  "/ne-obstaja",
];

// Pages that render signed out; everything else is behind the route guard (#11).
const PUBLIC_PAGES = new Set([
  "/login",
  "/register",
  "/auth-error",
  "/privacy",
]);

for (const path of PAGES) {
  test(`${path} has no WCAG A/AA violations`, async ({ page }, testInfo) => {
    if (!PUBLIC_PAGES.has(path)) requireSignedIn(testInfo);
    await page.goto(path);
    await page.getByRole("heading", { level: 1 }).first().waitFor();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    const summary = results.violations.map(
      (v) =>
        `${v.id} (${v.impact}): ${v.nodes
          .slice(0, 3)
          .map((n) => n.target.join(" "))
          .join(", ")}`,
    );
    expect(summary).toEqual([]);
  });
}

test("the document language is Slovenian", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("lang", "sl");
});
