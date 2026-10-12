import { expect, test, type Page } from "@playwright/test";
import { MIN_TARGET_PX, PAGES, VIEWPORTS } from "./viewports";
import { requireSignedIn } from "./env";

// Only the public auth pages render signed out; every other page is behind the route guard.
const PUBLIC_PAGE_TEST = new RegExp("^/(login|register|auth-error) fits");

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const root = document.scrollingElement ?? document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });
}

for (const viewport of VIEWPORTS) {
  test.describe(`${viewport.name} (${viewport.width}×${viewport.height})`, () => {
    test.use({
      viewport: { width: viewport.width, height: viewport.height },
      hasTouch: viewport.name !== "desktop",
    });
    test.beforeEach(({}, testInfo) => {
      if (!PUBLIC_PAGE_TEST.test(testInfo.title)) requireSignedIn(testInfo);
    });

    for (const { path, heading } of PAGES) {
      test(`${path} fits the screen and shows its heading`, async ({
        page,
      }) => {
        await page.goto(path);
        await expect(
          page.getByRole("heading", { level: 1, name: heading }),
        ).toBeVisible();
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
      });
    }

    test(`shows the ${viewport.nav} navigation only`, async ({ page }) => {
      await page.goto("/listings");
      const sidebar = page.getByRole("navigation", {
        name: "Glavna navigacija",
      });
      const mobile = page.getByRole("navigation", {
        name: "Mobilna navigacija",
      });
      if (viewport.nav === "mobile") {
        await expect(mobile).toBeVisible();
        await expect(sidebar).toBeHidden();
      } else {
        await expect(sidebar).toBeVisible();
        await expect(mobile).toBeHidden();
      }
    });

    test("navigates between sections with the visible navigation", async ({
      page,
    }) => {
      await page.goto("/listings");
      const nav = page.getByRole("navigation", {
        name:
          viewport.nav === "mobile"
            ? "Mobilna navigacija"
            : "Glavna navigacija",
      });
      await nav.getByRole("link", { name: /Priljubljene/ }).click();
      await expect(page).toHaveURL(/\/favorites$/);
      await expect(nav.getByRole("link", { name: /Priljubljene/ })).toHaveClass(
        /active/,
      );
    });

    test("search filters are usable and reach the URL", async ({ page }) => {
      await page.goto("/search");
      const location = page.getByLabel("Lokacija");
      await location.scrollIntoViewIfNeeded();
      await location.fill("Bežigrad");
      await expect(page).toHaveURL(/location=Be%C5%BEigrad/);
      await page.getByLabel("Razvrsti:").selectOption("price-asc");
      await expect(page).toHaveURL(/sort=price-asc/);
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
    });

    if (viewport.nav === "mobile") {
      test("bottom navigation has touch-sized targets and never covers content", async ({
        page,
      }) => {
        await page.goto("/favorites");
        const links = page
          .getByRole("navigation", { name: "Mobilna navigacija" })
          .getByRole("link");
        await expect(links).toHaveCount(5);
        for (const box of await links.evaluateAll((items) =>
          items.map((item) => item.getBoundingClientRect().toJSON()),
        )) {
          expect(box.width).toBeGreaterThanOrEqual(MIN_TARGET_PX);
          expect(box.height).toBeGreaterThanOrEqual(MIN_TARGET_PX);
        }

        // The last element of the page must end above the fixed bottom bar
        // once scrolled to the bottom.
        await page.evaluate(() =>
          window.scrollTo(0, document.body.scrollHeight),
        );
        const { contentBottom, navTop } = await page.evaluate(() => {
          const main = document.getElementById("main-content")!;
          const last = main.lastElementChild ?? main;
          const nav = document.querySelector(".mobile-nav")!;
          return {
            contentBottom: last.getBoundingClientRect().bottom,
            navTop: nav.getBoundingClientRect().top,
          };
        });
        expect(contentBottom).toBeLessThanOrEqual(navTop + 1);
      });
    }

    if (viewport.name === "tablet") {
      test("keeps the sidebar and content side by side without overlap", async ({
        page,
      }) => {
        await page.goto("/listings");
        const { sidebarRight, mainLeft } = await page.evaluate(() => ({
          sidebarRight: document
            .querySelector(".sidebar")!
            .getBoundingClientRect().right,
          mainLeft: document
            .getElementById("main-content")!
            .getBoundingClientRect().left,
        }));
        expect(mainLeft).toBeGreaterThanOrEqual(sidebarRight - 1);
      });
    }
  });
}
