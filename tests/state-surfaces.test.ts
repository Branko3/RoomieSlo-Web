import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8");

describe("empty/error/offline state route wiring", () => {
  it("keeps explicit loading, error, and empty branches on collection routes", () => {
    for (const path of [
      "app/listings/page.tsx",
      "app/search/page.tsx",
      "app/favorites/page.tsx",
    ]) {
      const page = source(path);
      expect(page).toContain("LoadingState");
      expect(page).toContain("DataState");
      expect(page).toContain("EmptyState");
      expect(page).toMatch(/error \?|!isLoading && error/);
    }
  });

  it("keeps unknown detail records distinct from request failures", () => {
    const page = source("app/listings/[id]/page.tsx");
    expect(page).toContain("<DataState error={error} onRetry={retry}>");
    expect(page).toContain("if (!listing)");
    expect(page).toContain("Oglas ni več na voljo");
    expect(page).toContain('href="/listings"');
  });

  it("preserves retry wiring on every affected data-state branch", () => {
    for (const path of [
      "app/listings/page.tsx",
      "app/search/page.tsx",
      "app/favorites/page.tsx",
      "app/listings/[id]/page.tsx",
    ]) {
      expect(source(path)).toContain("onRetry={retry}");
    }
  });
});
