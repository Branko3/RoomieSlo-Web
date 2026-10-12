import { expect, test } from "@playwright/test";

test.describe("auth pages", () => {
  test("login links to registration and back", async ({ page }) => {
    await page.goto("/login");
    await expect(
      page.getByRole("heading", { name: "Prijavi se v svoj račun" }),
    ).toBeVisible();
    await expect(page.getByLabel("E-naslov")).toHaveAttribute("type", "email");
    await expect(page.getByLabel("Geslo")).toHaveAttribute("type", "password");

    await page.getByRole("link", { name: "Registriraj se" }).click();
    await expect(page).toHaveURL(/\/register$/);
    await expect(
      page.getByRole("heading", { name: "Ustvari svoj račun" }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Prijava" }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});
