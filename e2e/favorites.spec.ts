import { expect, test } from "@playwright/test";
import {
  FAVORITES_KEY,
  listingId,
  pageAlerts,
  requireSignedIn,
  supabaseConfigured,
} from "./env";

test.describe("favorites", () => {
  test("without Supabase configuration, explains why favorites cannot load", async ({
    page,
  }) => {
    test.skip(
      supabaseConfigured,
      "Only meaningful without Supabase variables.",
    );
    // The route guard explains the missing configuration before the page loads.
    await page.goto("/favorites");
    await expect(page).toHaveURL(/\/auth-error\?reason=configuration$/);
    await expect(pageAlerts(page)).toContainText("Supabase");
  });

  test("empty collection links to search", async ({ page }, testInfo) => {
    test.skip(
      !supabaseConfigured || testInfo.project.name !== "authenticated",
      "Requires staging data and the authenticated project.",
    );
    await page.addInitScript(
      (key) => window.localStorage.setItem(key, "[]"),
      FAVORITES_KEY,
    );
    await page.goto("/favorites");
    await expect(
      page.getByRole("heading", { name: "Še nimaš shranjenih oglasov" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Razišči oglase" }).click();
    await expect(page).toHaveURL(/\/search$/);
  });

  test("recovers from corrupt saved favorites", async ({ page }, testInfo) => {
    requireSignedIn(testInfo);
    await page.addInitScript(
      (key) => window.localStorage.setItem(key, "{broken"),
      FAVORITES_KEY,
    );
    await page.goto("/favorites");
    await expect(
      page.getByRole("heading", { name: "Priljubljeni oglasi" }),
    ).toBeVisible();
    // Signed in, favorites come from Supabase; corrupt local data must not break the page.
    await expect(pageAlerts(page)).toHaveCount(0);
  });

  test("a listing saved from its detail page appears in favorites after reload", async ({
    page,
  }, testInfo) => {
    test.skip(
      !supabaseConfigured ||
        !listingId ||
        testInfo.project.name !== "authenticated",
      "Requires staging data, E2E_LISTING_ID, and the authenticated project.",
    );
    // Start from an empty collection once, then keep what the test saves.
    await page.addInitScript((key) => {
      if (!window.sessionStorage.getItem("e2e-seeded")) {
        window.localStorage.setItem(key, "[]");
        window.sessionStorage.setItem("e2e-seeded", "1");
      }
    }, FAVORITES_KEY);
    await page.goto(`/listings/${listingId}`);
    await page.getByRole("button", { name: "♡ Shrani oglas" }).click();
    await expect(
      page.getByRole("button", { name: "♥ Odstrani iz priljubljenih" }),
    ).toHaveAttribute("aria-pressed", "true");

    await page.goto("/favorites");
    await page.reload();
    const remove = page.getByRole("button", {
      name: /^Odstrani .* iz priljubljenih$/,
    });
    await expect(remove).toHaveCount(1);
    await remove.click();
    await expect(
      page.getByRole("heading", { name: "Še nimaš shranjenih oglasov" }),
    ).toBeVisible();
  });
});
