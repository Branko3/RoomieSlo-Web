import { expect, test } from "@playwright/test";
import { requireSignedIn } from "./env";

// "Moji oglasi" holds the signed-in user's listings; the browsing feeds never do.
test.describe("my listings", () => {
  test.beforeEach(({}, testInfo) => requireSignedIn(testInfo));

  test("lists the user's own listings, each with its status and edit link", async ({
    page,
  }) => {
    await page.goto("/listings/mine");
    await expect(
      page.getByRole("heading", { level: 1, name: "Moji oglasi" }),
    ).toBeVisible();
    const cards = page.getByRole("article");
    const empty = page.getByRole("heading", { name: "Še nimaš oglasov" });
    await expect(cards.first().or(empty)).toBeVisible();
    for (const card of await cards.all()) {
      await expect(card.getByText(/^(Na voljo|Zapolnjeno)$/)).toBeVisible();
      await expect(
        card.getByRole("link", { name: /^Uredi oglas / }),
      ).toBeVisible();
    }
  });

  test("keeps the user's own listings out of the dashboard and search", async ({
    page,
  }) => {
    await page.goto("/listings/mine");
    await expect(
      page.getByRole("heading", { level: 1, name: "Moji oglasi" }),
    ).toBeVisible();
    await expect(page.getByRole("status")).toHaveCount(0);
    const own = await page
      .getByRole("article")
      .locator("h3 a")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    test.skip(own.length === 0, "The signed-in test user has no listings.");

    for (const path of ["/search", "/listings"]) {
      await page.goto(path);
      await expect(page.getByRole("status")).toHaveCount(0);
      for (const href of own) {
        await expect(
          page.locator(`.listing-grid a[href="${href}"]`),
        ).toHaveCount(0);
      }
    }
  });
});
