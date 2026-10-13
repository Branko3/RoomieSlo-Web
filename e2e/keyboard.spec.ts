import { expect, test, type Page } from "@playwright/test";
import { requireSignedIn } from "./env";

// Only the auth pages render signed out; the rest are behind the route guard.
const PUBLIC_TEST = new RegExp("^/(login|register):|login form");

const PAGES = [
  "/listings",
  "/search",
  "/chats",
  "/favorites",
  "/profile",
  "/login",
  "/register",
];

/** Describes the focused element: tag, accessible-ish name, and outline style. */
async function focused(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return null;
    const style = getComputedStyle(el);
    return {
      tag: el.tagName.toLowerCase(),
      name: (
        el.getAttribute("aria-label") ??
        el.getAttribute("title") ??
        el.textContent ??
        ""
      )
        .replace(/\s+/g, " ")
        .trim(),
      outline: style.outlineStyle,
      outlineWidth: parseFloat(style.outlineWidth),
      id: el.id,
    };
  });
}

/** Tabs through the page and returns what received focus, stopping at a repeat. */
async function tabOrder(page: Page, max = 40) {
  const seen: NonNullable<Awaited<ReturnType<typeof focused>>>[] = [];
  for (let i = 0; i < max; i += 1) {
    await page.keyboard.press("Tab");
    const current = await focused(page);
    if (!current) break;
    const handle = await page.evaluateHandle(() => document.activeElement);
    const already = await page.evaluate(
      (el) => (el as HTMLElement).dataset.e2eSeen === "1",
      handle,
    );
    if (already) break;
    await page.evaluate((el) => {
      (el as HTMLElement).dataset.e2eSeen = "1";
    }, handle);
    seen.push(current);
  }
  return seen;
}

test.describe("keyboard journey", () => {
  test.beforeEach(({}, testInfo) => {
    if (!PUBLIC_TEST.test(testInfo.title)) requireSignedIn(testInfo);
  });

  test("the first Tab reaches the skip link, which jumps to the content", async ({
    page,
  }) => {
    await page.goto("/listings");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Preskoči na vsebino" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main-content$/);
    // The next Tab continues inside the main content, past the sidebar.
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(() =>
        Boolean(document.activeElement?.closest("#main-content")),
      ),
    ).toBe(true);
  });

  test("sidebar links are reachable in visual order and open with Enter", async ({
    page,
  }) => {
    await page.goto("/listings");
    const order = (await tabOrder(page, 10)).map((item) => item.name);
    const nav = ["Oglasi", "Iskanje", "Klepeti", "Priljubljene", "Profil"];
    const positions = nav.map((label) =>
      order.findIndex((name) => name.endsWith(label)),
    );
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);

    await page
      .getByRole("link", { name: /Klepeti/ })
      .first()
      .focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/chats$/);
  });

  for (const path of PAGES) {
    test(`${path}: every focus stop is named and visibly outlined`, async ({
      page,
    }) => {
      await page.goto(path);
      const stops = await tabOrder(page);
      expect(stops.length).toBeGreaterThan(0);
      for (const stop of stops) {
        expect(stop.name, `${path} ${stop.tag}`).not.toBe("");
        expect(stop.outline, `${path} ${stop.tag} "${stop.name}"`).not.toBe(
          "none",
        );
        expect(stop.outlineWidth).toBeGreaterThanOrEqual(2);
      }
    });
  }

  test("search filters work with the keyboard alone", async ({ page }) => {
    await page.goto("/search");
    await page.getByLabel("Lokacija").focus();
    await page.keyboard.type("Center");
    await expect(page).toHaveURL(/location=Center/);

    await page.getByLabel(/Največji proračun/).focus();
    await page.keyboard.press("ArrowLeft");
    await expect(page).toHaveURL(/maxPrice=590/);

    await page.getByLabel("Razvrsti:").focus();
    await page.keyboard.press("ArrowDown");
    await expect(page).toHaveURL(/sort=/);
  });

  test("the availability toggle works with Space and reports its state", async ({
    page,
  }) => {
    await page.goto("/profile");
    const toggle = page.getByRole("button", {
      name: "Preklopi razpoložljivost",
    });
    // The state is saved to the profile, so toggle relative to it and restore it.
    const before = (await toggle.getAttribute("aria-pressed")) ?? "false";
    const flipped = before === "true" ? "false" : "true";
    await toggle.focus();
    await page.keyboard.press("Space");
    await expect(toggle).toHaveAttribute("aria-pressed", flipped);
    await expect(toggle).not.toHaveAttribute("aria-busy", "true");
    await page.keyboard.press("Enter");
    await expect(toggle).toHaveAttribute("aria-pressed", before);
    await expect(toggle).not.toHaveAttribute("aria-busy", "true");
  });

  test("the login form can be filled and submitted without a mouse", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("E-naslov").focus();
    await page.keyboard.type("ana@example.test");
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Geslo")).toBeFocused();
    await page.keyboard.type("geslo1234");
    await page.getByRole("button", { name: "Prijava" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText(/prijava je uspešna/i)).toBeVisible();
  });
});
