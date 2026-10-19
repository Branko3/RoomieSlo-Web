import { expect, test } from "@playwright/test";
import { listingId, supabaseConfigured } from "./env";

test.describe("listing detail", () => {
  test.skip(
    !supabaseConfigured || !listingId,
    "Requires staging data and E2E_LISTING_ID.",
  );

  test("sends a match request and offers the chats", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "authenticated",
      "Requires the authenticated project.",
    );
    await page.goto(`/listings/${listingId}`);
    await page
      .getByLabel("Sporočilo lastniku (neobvezno)")
      .fill("Pozdravljeni, zanima me ogled.");
    await page
      .getByRole("button", { name: "Pošlji zahtevo za ujemanje" })
      .click();
    await expect(page.getByText("Zahteva je poslana.")).toBeVisible();
    await page.getByRole("link", { name: "Odpri klepete" }).click();
    await expect(page).toHaveURL(/\/chats$/);
  });

  test("goes back to the listings", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "authenticated",
      "Requires the authenticated project.",
    );
    await page.goto(`/listings/${listingId}`);
    await page.getByRole("link", { name: "Nazaj na oglase" }).click();
    await expect(page).toHaveURL(/\/listings$/);
  });
});
