import { expect, test } from "@playwright/test";
import { requireSignedIn, supabaseConfigured } from "./env";

// Never deletes the staging test account: the real deletion is covered by
// integration/deletion.int.ts with a throwaway user. Here every call to the
// function is intercepted and counted.
test.describe("/profile/delete-account", () => {
  test("is behind the route guard", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "unauthenticated",
      "Signed-out check only.",
    );
    await page.goto("/profile/delete-account");
    await expect(page).toHaveURL(
      supabaseConfigured
        ? /\/login\?returnTo=%2Fprofile%2Fdelete-account$/
        : /\/auth-error\?reason=configuration$/,
    );
  });

  test("explains the consequences, can be cancelled, and sends nothing for a wrong phrase", async ({
    page,
  }, testInfo) => {
    requireSignedIn(testInfo);
    let calls = 0;
    await page.route("**/functions/v1/delete-account", async (route) => {
      calls += 1;
      await route.fulfill({ status: 500, body: "{}" });
    });

    await page.goto("/profile");
    await page.getByRole("link", { name: "Izbriši račun" }).click();
    await expect(page).toHaveURL(/\/profile\/delete-account$/);
    await expect(
      page.getByRole("heading", { name: "Izbriši račun" }),
    ).toBeVisible();
    await expect(page.getByText("Takoj izbrišemo")).toBeVisible();
    await expect(page.getByText("Ostane, brez tvojega imena")).toBeVisible();
    await expect(
      page.getByText(/Varnostne kopije potečejo v 30 dneh/),
    ).toBeVisible();

    await page.getByLabel("Geslo").fill("napačno-geslo");
    await page.getByLabel(/Za potrditev vpiši/).fill("BRIŠI");
    await page.getByRole("button", { name: "Trajno izbriši račun" }).click();
    const error = page.locator("form").getByRole("alert");
    await expect(error).toContainText("IZBRIŠI");
    await expect(error).toBeFocused();
    expect(calls).toBe(0);

    await page.getByRole("link", { name: "Prekliči" }).click();
    await expect(page).toHaveURL(/\/profile$/);
  });

  test("shows the deletion notice on the login page", async ({ page }) => {
    await page.goto("/login?deleted=1");
    await expect(
      page.locator("form").getByRole("status").filter({
        hasText: "Račun je izbrisan.",
      }),
    ).toBeVisible();
  });
});
