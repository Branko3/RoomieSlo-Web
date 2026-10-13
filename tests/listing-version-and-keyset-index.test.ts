import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cursorFilter } from "../lib/listings/pagination";

// Static checks only: the SQL is not executed here (no Supabase project or CLI).
const NAME = "20261013000100_listing_version_and_keyset_index.sql";
const dir = join(process.cwd(), "supabase/migrations");
const files = readdirSync(dir)
  .filter((file) => file.endsWith(".sql"))
  .sort();
const sql = readFileSync(join(dir, NAME), "utf8")
  .toLowerCase()
  .replace(/\s+/g, " ");

describe("listing version trigger", () => {
  it("runs after the baseline that created listings.version", () => {
    expect(files.indexOf(NAME)).toBeGreaterThan(
      files.indexOf("20261007000000_android_baseline.sql"),
    );
  });

  it("bumps the version whenever another column changes, for every caller", () => {
    expect(sql).toContain(
      "if (to_jsonb(new) - 'version') is distinct from (to_jsonb(old) - 'version') then new.version := old.version + 1;",
    );
    // A no-op update keeps the version, and a client cannot set it freely.
    expect(sql).toContain("else new.version := old.version;");
    expect(sql).not.toContain("auth.role()");
    expect(sql).toContain(
      "create trigger bump_listing_version before update on public.listings for each row execute function public.bump_listing_version()",
    );
    expect(sql).toContain(
      "revoke all on function public.bump_listing_version() from public",
    );
  });
});

describe("feed keyset index", () => {
  it("matches the feed order and its is_filled filter", () => {
    expect(sql).toContain(
      "on public.listings (created_at desc, id desc) where is_filled = false",
    );
    expect(sql).toContain(
      "drop index if exists public.listings_available_created_idx",
    );
  });

  it("serves the cursor condition the feed sends", () => {
    // Both columns of the condition are the index columns, in index order.
    expect(
      cursorFilter({ createdAt: "2026-10-01T00:00:00Z", id: "x" }),
    ).toMatch(/^created_at\.lt\..*,and\(created_at\.eq\..*,id\.lt\.x\)$/);
  });
});
