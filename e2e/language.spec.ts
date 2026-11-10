import { expect, test, type BrowserContext } from "@playwright/test";
import { requireSignedIn } from "./env";

// The interface language: the `roomieslo-locale` cookie, then Accept-Language,
// then Slovenian (lib/i18n/config.ts). Runs signed out on the public pages.

async function setLocaleCookie(
  context: BrowserContext,
  baseURL: string | undefined,
  locale: "sl" | "en",
) {
  await context.addCookies([
    { name: "roomieslo-locale", value: locale, url: baseURL ?? "" },
  ]);
}

// /login and /register send signed-in visitors on, so these run signed out.
test.beforeEach(({}, testInfo) => {
  test.skip(
    testInfo.project.name === "authenticated" &&
      !testInfo.title.includes("signed in"),
    "Public pages redirect a signed-in visitor.",
  );
});

test.describe("language", () => {
  test("the cookie selects English on /login and /register", async ({
    page,
    context,
    baseURL,
  }) => {
    await setLocaleCookie(context, baseURL, "en");
    for (const path of ["/login", "/register"]) {
      await page.goto(path);
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      await expect(page).toHaveTitle("RoomieSlo — find your home");
      await expect(page.getByRole("group", { name: "Language" })).toBeVisible();
      await expect(
        page.getByRole("button", { name: "English" }),
      ).toHaveAttribute("aria-pressed", "true");
    }
  });

  // Enable when the auth area moves the /login and /register copy into the
  // `auth` namespace (delivery plan, step 2).
  test.fixme("/login and /register text is English", async ({
    page,
    context,
    baseURL,
  }) => {
    await setLocaleCookie(context, baseURL, "en");
    await page.goto("/login");
    await expect(
      page.getByRole("heading", { level: 1, name: "Sign in to your account" }),
    ).toBeVisible();
    await page.goto("/register");
    await expect(
      page.getByRole("heading", { level: 1, name: "Create your account" }),
    ).toBeVisible();
  });

  test("switching back through the UI persists across a reload", async ({
    page,
    context,
    baseURL,
  }) => {
    await setLocaleCookie(context, baseURL, "en");
    await page.goto("/login");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    // Keyboard: focus the option and activate it.
    const slovenian = page.getByRole("button", { name: "Slovenščina" });
    await expect(slovenian).toHaveAttribute("lang", "sl");
    await slovenian.focus();
    await page.keyboard.press("Enter");

    // router.refresh() swaps the catalog and <html lang> without a reload.
    await expect(page.locator("html")).toHaveAttribute("lang", "sl");
    await expect(page.getByRole("group", { name: "Jezik" })).toBeVisible();
    await expect(slovenian).toHaveAttribute("aria-pressed", "true");

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "sl");
    const cookies = await context.cookies();
    expect(cookies.find((c) => c.name === "roomieslo-locale")?.value).toBe(
      "sl",
    );
  });
});

test.describe("an English-speaking browser without a cookie", () => {
  test.use({ locale: "en-GB" });

  test("gets English", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });
});

test.describe("a Slovenian browser without a cookie", () => {
  test.use({ locale: "sl-SI" });

  test("gets Slovenian", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("html")).toHaveAttribute("lang", "sl");
    await expect(page).toHaveTitle("RoomieSlo — najdi svoj dom");
  });
});

test("signed in, the sidebar switcher changes the shell language", async ({
  page,
  context,
  baseURL,
}, testInfo) => {
  requireSignedIn(testInfo);
  await setLocaleCookie(context, baseURL, "sl");
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/listings");
  const nav = page.getByRole("navigation", { name: "Glavna navigacija" });
  await expect(nav.getByRole("link", { name: "Oglasi" })).toBeVisible();

  await page
    .getByRole("group", { name: "Jezik" })
    .getByRole("button", { name: "English" })
    .click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(
    page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "Listings" }),
  ).toBeVisible();
  await setLocaleCookie(context, baseURL, "sl");
});
