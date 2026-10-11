import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BREAKPOINTS, PAGES, VIEWPORTS } from "../e2e/viewports";

const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
const mediaWidths = [...css.matchAll(/@media \(max-width: (\d+)px\)/g)].map(
  ([, width]) => Number(width),
);

describe("viewport matrix", () => {
  it("matches the breakpoints defined in globals.css", () => {
    expect(mediaWidths).toContain(BREAKPOINTS.mobileMax);
    expect(mediaWidths).toContain(BREAKPOINTS.tabletMax);
  });

  it("hides the sidebar exactly at the mobile breakpoint", () => {
    const mobileBlock = css.split(
      `@media (max-width: ${BREAKPOINTS.mobileMax}px)`,
    )[1];
    expect(mobileBlock).toMatch(/\.sidebar \{\s*display: none;/);
    expect(mobileBlock).toMatch(/\.mobile-nav \{[^}]*display: flex;/);
  });

  it("puts one width on each side of every breakpoint", () => {
    const [mobile, tablet, desktop] = VIEWPORTS;
    expect(mobile.width).toBeLessThanOrEqual(BREAKPOINTS.mobileMax);
    expect(tablet.width).toBeGreaterThan(BREAKPOINTS.mobileMax);
    expect(tablet.width).toBeLessThanOrEqual(BREAKPOINTS.tabletMax);
    expect(desktop.width).toBeGreaterThan(BREAKPOINTS.tabletMax);
  });

  it("expects the navigation the CSS shows at each width", () => {
    for (const viewport of VIEWPORTS) {
      expect(viewport.nav).toBe(
        viewport.width <= BREAKPOINTS.mobileMax ? "mobile" : "sidebar",
      );
    }
  });

  it("covers every top-level page route on main", () => {
    const routes = readdirSync(join(process.cwd(), "app"), {
      withFileTypes: true,
    })
      .filter((entry) => entry.isDirectory())
      .map((entry) => `/${entry.name}`)
      .filter((route) => !route.includes("["));
    const covered = PAGES.map((page) => page.path);
    for (const route of routes) {
      expect(covered, route).toContain(route);
    }
  });
});
