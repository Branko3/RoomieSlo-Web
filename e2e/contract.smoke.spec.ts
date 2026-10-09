import { expect, test } from "@playwright/test";

const stagingListingId = process.env.E2E_LISTING_ID;
const hasStagingContract = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  stagingListingId &&
  process.env.E2E_AUTH_STATE,
);
const hasPublicStaging = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
const skipReason =
  "Staging smoke skipped: set public Supabase variables, E2E_LISTING_ID, and E2E_AUTH_STATE.";

test("starts with public Supabase configuration handling", async ({ page }) => {
  await page.goto("/listings");
  await expect(
    page.getByRole("heading", { name: "Oglasi za sobe" }),
  ).toBeVisible();

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    await expect(page.getByRole("alert")).toContainText("Supabase");
  }
});

test("preserves search filter state in the URL", async ({ page }) => {
  await page.goto("/search?location=Be%C5%BEigrad&maxPrice=450&sort=price-asc");
  await expect(page.getByLabel("Lokacija")).toHaveValue("Bežigrad");
  await expect(page.getByLabel("Največji proračun")).toHaveValue("450");
  await expect(page.getByLabel("Razvrsti:")).toHaveValue("price-asc");
});

test.describe("staging listing contract", () => {
  test.skip(!hasStagingContract, skipReason);

  test("loads authenticated listing data", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "authenticated",
      "Requires the authenticated Playwright project.",
    );
    await page.goto("/listings");
    await expect(
      page.getByRole("heading", { name: "Oglasi za sobe" }),
    ).toBeVisible();
    await expect(
      page.getByText("Oglasov ni mogoče naložiti"),
    ).not.toBeVisible();
  });

  test("loads a valid listing detail", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "authenticated",
      "Requires the authenticated Playwright project.",
    );
    await page.goto(`/listings/${stagingListingId}`);
    await expect(
      page.getByRole("heading", { name: "Oglasa ni mogoče naložiti" }),
    ).not.toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("recovers from an unknown listing", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "authenticated",
      "Requires the authenticated Playwright project.",
    );
    await page.goto("/listings/00000000-0000-0000-0000-000000000000");
    await expect(
      page.getByRole("heading", { name: "Oglas ni več na voljo" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Na oglase" })).toHaveAttribute(
      "href",
      "/listings",
    );
  });

  test("preserves authenticated favorite interaction", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "authenticated",
      "Requires the authenticated Playwright project.",
    );
    await page.goto(`/listings/${stagingListingId}`);
    const favorite = page.getByRole("button", {
      name: /Shrani oglas|Odstrani iz priljubljenih/,
    });
    await expect(favorite).toBeVisible();
    await favorite.click();
    await expect(favorite).toHaveAttribute("aria-pressed", "true");
  });
});

test.describe("staging authorization contract", () => {
  test.skip(
    !hasPublicStaging,
    "Staging security checks skipped: set public Supabase variables.",
  );

  for (const scenario of [
    "unauthenticated listing reads",
    "favorite mutation authorization",
    "profile and questionnaire ownership",
    "match and message participant access",
    "report and admin access",
    "vpisnice Storage ownership",
    "expired-session handling",
    "offline and backend-denied states",
  ]) {
    test(`${scenario} requires disposable staging execution`, async () => {
      test.skip(
        true,
        "Requires disposable staging credentials and controlled auth fixtures.",
      );
    });
  }
});
