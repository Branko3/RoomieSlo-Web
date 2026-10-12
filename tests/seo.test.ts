import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import nextConfig from "../next.config.mjs";
import robots from "../app/robots";
import {
  isPrivatePath,
  NOINDEX,
  PRIVATE_PREFIXES,
  PUBLIC_PATHS,
  robotsPolicy,
} from "../lib/seo";

type HeaderRule = {
  source: string;
  headers: Array<{ key: string; value: string }>;
};

async function headerRules(): Promise<HeaderRule[]> {
  const headers = (nextConfig as { headers?: () => Promise<HeaderRule[]> })
    .headers;
  if (!headers) throw new Error("next.config.mjs has no headers()");
  return headers();
}

describe("isPrivatePath", () => {
  it("treats every app section and its sub-routes as private", () => {
    for (const path of [
      "/listings",
      "/listings/abc",
      "/search?location=Center",
      "/chats/m1",
      "/favorites",
      "/profile",
      "/admin/reports",
      "/report/u1?from=chat",
    ]) {
      expect(isPrivatePath(path), path).toBe(true);
    }
  });

  it("keeps public pages and look-alike paths public", () => {
    for (const path of ["/", "/login", "/register", "/listingsx", "/reports"]) {
      expect(isPrivatePath(path), path).toBe(false);
    }
  });
});

describe("robots.txt", () => {
  it("allows only the public pages and disallows every private section", () => {
    const policy = robotsPolicy();
    expect(policy.rules).toEqual({
      userAgent: "*",
      allow: [...PUBLIC_PATHS],
      disallow: [...PRIVATE_PREFIXES],
    });
    expect(policy).not.toHaveProperty("host");
  });

  it("adds the host only when a site URL is configured", () => {
    expect(robotsPolicy("https://roomieslo.si/").host).toBe(
      "https://roomieslo.si",
    );
  });

  it("is served from app/robots.ts", () => {
    expect(robots().rules).toEqual(robotsPolicy().rules);
  });

  it("covers every top-level app route as public or private", () => {
    const routes = readdirSync(join(process.cwd(), "app"), {
      withFileTypes: true,
    })
      .filter((entry) => entry.isDirectory())
      .map((entry) => `/${entry.name}`);
    for (const route of routes) {
      const known =
        (PUBLIC_PATHS as readonly string[]).includes(route) ||
        isPrivatePath(route);
      expect(known, `${route} needs an indexing decision in lib/seo.ts`).toBe(
        true,
      );
    }
  });
});

describe("response headers (next.config.mjs)", () => {
  it("sends X-Robots-Tag noindex for exactly the private prefixes", async () => {
    const rules = await headerRules();
    const noindexSources = rules
      .filter((rule) =>
        rule.headers.some(
          (h) => h.key === "X-Robots-Tag" && h.value === NOINDEX,
        ),
      )
      .map((rule) => rule.source)
      .sort();
    const expected = PRIVATE_PREFIXES.flatMap((p) => [p, `${p}/:path*`]).sort();
    expect(noindexSources).toEqual(expected);
  });

  it("sends privacy headers on every response", async () => {
    const all = (await headerRules()).find((rule) => rule.source === "/:path*");
    const headers = Object.fromEntries(
      (all?.headers ?? []).map((h) => [h.key, h.value]),
    );
    expect(headers).toMatchObject({
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    });
    expect(headers["Permissions-Policy"]).toContain("geolocation=()");
  });

  it("does not advertise the framework", () => {
    expect((nextConfig as { poweredByHeader?: boolean }).poweredByHeader).toBe(
      false,
    );
  });
});

describe("page metadata", () => {
  const read = (path: string) =>
    readFileSync(join(process.cwd(), path), "utf8");

  it("is private by default in the root layout", () => {
    expect(read("app/layout.tsx")).toMatch(
      /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/,
    );
  });

  it("opts the public pages in", () => {
    for (const page of PUBLIC_PATHS) {
      expect(read(`app${page}/layout.tsx`)).toMatch(
        /robots:\s*\{\s*index:\s*true,\s*follow:\s*true\s*\}/,
      );
    }
  });
});
