import { expect, test } from "@playwright/test";
import { NAV } from "./env";

test.describe("app shell navigation", () => {
  for (const { route, label, heading } of NAV) {
    test(`opens ${label} from the sidebar and marks it active`, async ({
      page,
    }) => {
      await page.goto("/listings");
      const nav = page.getByRole("navigation", { name: "Glavna navigacija" });
      await nav.getByRole("link", { name: label }).click();
      await expect(page).toHaveURL(new RegExp(`/${route}$`));
      await expect(
        page.getByRole("heading", { level: 1, name: heading }),
      ).toBeVisible();
      await expect(nav.getByRole("link", { name: label })).toHaveClass(
        /active/,
      );
    });
  }

  test("shows the mobile navigation on a phone viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/search");
    const mobile = page.getByRole("navigation", { name: "Mobilna navigacija" });
    await expect(mobile).toBeVisible();
    await mobile.getByRole("link", { name: "Klepeti" }).click();
    await expect(page).toHaveURL(/\/chats$/);
  });

  test("skip link moves focus past the navigation", async ({ page }) => {
    await page.goto("/listings");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Preskoči na vsebino" });
    await expect(skip).toBeFocused();
    await skip.press("Enter");
    await expect(page).toHaveURL(/#main-content$/);
  });

  test("unknown routes show the not-found page with a way back", async ({
    page,
  }) => {
    const response = await page.goto("/ne-obstaja");
    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { name: "Stran ne obstaja" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Na oglase" }).click();
    await expect(page).toHaveURL(/\/listings$/);
  });
});
