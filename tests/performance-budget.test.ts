import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { crossBrowserProjects, parseBrowsers } from "../e2e/browsers";
import {
  checkBudget,
  firstLoadFiles,
  layoutChain,
  routeOf,
} from "../scripts/bundle-budget.mjs";

describe("bundle budget", () => {
  it("finds the layouts that wrap a page", () => {
    expect(layoutChain("/page")).toEqual(["/layout"]);
    expect(layoutChain("/listings/[id]/page")).toEqual([
      "/layout",
      "/listings/layout",
      "/listings/[id]/layout",
    ]);
  });

  it("maps page entries to routes", () => {
    expect(routeOf("/page")).toBe("/");
    expect(routeOf("/listings/[id]/page")).toBe("/listings/[id]");
  });

  it("counts shared, layout, and page JS once per page, ignoring CSS", () => {
    const files = firstLoadFiles(
      { rootMainFiles: ["a.js", "b.js"] },
      {
        pages: {
          "/layout": ["b.js", "layout.js", "app.css"],
          "/listings/layout": ["listings-layout.js"],
          "/listings/page": ["listings.js", "b.js"],
          "/login/page": ["login.js"],
          "/error": ["error.js"],
        },
      },
    );
    expect(files).toEqual({
      "/listings": [
        "a.js",
        "b.js",
        "layout.js",
        "listings-layout.js",
        "listings.js",
      ],
      "/login": ["a.js", "b.js", "layout.js", "login.js"],
    });
  });

  it("reports routes and shared JS over budget, honoring route overrides", () => {
    const budget = {
      sharedKb: 100,
      defaultRouteKb: 200,
      routes: { "/search": 250 },
    };
    expect(
      checkBudget(
        { "/": 150 * 1024, "/search": 240 * 1024, "/chats": 201 * 1024 },
        budget,
        101 * 1024,
      ),
    ).toEqual([
      { route: "(shared)", bytes: 101 * 1024, limitKb: 100 },
      { route: "/chats", bytes: 201 * 1024, limitKb: 200 },
    ]);
    expect(checkBudget({ "/": 1 }, budget, 1)).toEqual([]);
  });

  it("keeps a committed budget with headroom rules", () => {
    const budget = JSON.parse(
      readFileSync(join(process.cwd(), "perf-budget.json"), "utf8"),
    );
    expect(budget.sharedKb).toBeGreaterThan(0);
    expect(budget.defaultRouteKb).toBeGreaterThan(budget.sharedKb);
  });
});

describe("cross-browser projects", () => {
  it("adds nothing by default, so Chromium-only runs are unchanged", () => {
    expect(crossBrowserProjects(undefined)).toEqual([]);
    expect(crossBrowserProjects("")).toEqual([]);
  });

  it("adds the requested engines once each", () => {
    const projects = crossBrowserProjects(" Firefox,webkit,firefox ");
    expect(projects.map((p) => p.name)).toEqual(["firefox", "webkit"]);
    expect(projects[0].use.defaultBrowserType).toBe("firefox");
    expect(projects[1].use.defaultBrowserType).toBe("webkit");
  });

  it("supports mobile engines", () => {
    const [chrome, safari] = crossBrowserProjects(
      "mobile-chrome,mobile-safari",
    );
    expect(chrome.use.isMobile).toBe(true);
    expect(safari.use.defaultBrowserType).toBe("webkit");
  });

  it("rejects unknown names instead of silently skipping them", () => {
    expect(() => parseBrowsers("firefox,edge")).toThrow(/edge/);
  });
});

describe("supported browsers", () => {
  it("declares the browserslist matching Next.js 14 defaults", () => {
    const pkg = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8"),
    );
    expect(pkg.browserslist).toEqual([
      "chrome 64",
      "edge 79",
      "firefox 67",
      "opera 51",
      "safari 12",
    ]);
  });
});
