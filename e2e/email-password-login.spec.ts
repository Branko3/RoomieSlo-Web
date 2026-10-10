import { expect, test } from "@playwright/test";

const hasStagingAuth = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  process.env.E2E_AUTH_STATE,
);

test.describe("login public contract", () => {
  test("exposes labeled fields and keyboard validation", async ({ page }) => {
    await page.goto("/login");
    await expect(
      page.getByRole("heading", { name: "Prijavi se v svoj račun" }),
    ).toBeVisible();
    await expect(page.getByLabel("E-naslov")).toHaveAttribute(
      "autocomplete",
      "email",
    );
    await expect(page.getByLabel("Geslo")).toHaveAttribute(
      "autocomplete",
      "current-password",
    );

    await page.getByLabel("E-naslov").fill("not-an-email");
    await page.getByRole("button", { name: "Prijava" }).press("Enter");
    await expect(page.getByRole("alert")).toContainText("veljaven e-naslov");
    await expect(page.getByLabel("E-naslov")).toBeFocused();
  });

  for (const viewport of [
    { name: "mobile", width: 390, height: 844 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "desktop", width: 1440, height: 900 },
  ]) {
    test(`renders at ${viewport.name} size`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto("/login");
      await expect(page.locator("form.auth-card")).toBeVisible();
    });
  }
});

test.describe("authenticated login contract", () => {
  test.skip(
    !hasStagingAuth,
    "Requires configured staging auth state and public Supabase variables.",
  );

  test("covers safe requested redirect, signed-in login redirect, logout, and refresh persistence", async () => {
    test.skip(
      true,
      "Requires staging credentials and the authenticated Playwright project.",
    );
  });

  test("covers denial before session confirmation", async () => {
    test.skip(true, "Requires controlled staging session fixtures.");
  });
});
