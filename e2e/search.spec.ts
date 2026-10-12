import { expect, test } from "@playwright/test";
import { requireSignedIn } from "./env";

test.describe("search workflow", () => {
  test.beforeEach(({}, testInfo) => requireSignedIn(testInfo));

  test("writes filters to the URL and restores them on reload", async ({
    page,
  }) => {
    await page.goto("/search");
    await page.getByLabel("Lokacija").fill("Rožna dolina");
    await expect(page).toHaveURL(/location=Ro%C5%BEna(\+|%20)dolina/);

    await page.getByLabel("Razvrsti:").selectOption("price-desc");
    await expect(page).toHaveURL(/sort=price-desc/);

    await page.reload();
    await expect(page.getByLabel("Lokacija")).toHaveValue("Rožna dolina");
    await expect(page.getByLabel("Razvrsti:")).toHaveValue("price-desc");
  });

  test("removes a filter chip and clears all filters", async ({ page }) => {
    await page.goto("/search?location=Center&maxPrice=400&sort=newest");
    await page.getByRole("button", { name: "Center ×" }).click();
    await expect(page.getByLabel("Lokacija")).toHaveValue("");

    await page.getByRole("button", { name: "Počisti filtre" }).click();
    await expect(page).toHaveURL(/\/search$/);
    await expect(page.getByLabel("Razvrsti:")).toHaveValue("relevance");
  });

  test("announces the result count politely", async ({ page }) => {
    await page.goto("/search");
    await expect(
      page.locator("h2[aria-live=polite]").filter({ hasText: "zate" }),
    ).toBeVisible();
  });
});
