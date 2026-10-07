import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getSupabaseConfig } from "../lib/config";

const root = join(process.cwd(), "lib");
const sourceFiles = readdirSync(root, { recursive: true })
  .filter((file): file is string => typeof file === "string" && /\.(ts|tsx)$/.test(file))
  .map((file) => join(root, file));

describe("browser Supabase boundary", () => {
  it("reports an explicit unconfigured state when public variables are absent", () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    expect(getSupabaseConfig()).toEqual({
      configured: false,
      url: "",
      anonKey: "",
    });

    if (originalUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalKey !== undefined) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
  });

  it("accepts only the two public browser variables", () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    expect(getSupabaseConfig()).toEqual({
      configured: true,
      url: "https://example.supabase.co",
      anonKey: "anon-key",
    });
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
  });

  it("does not treat a service-role variable as browser configuration", () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const originalServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "must-not-be-used";

    expect(getSupabaseConfig()).toEqual({
      configured: true,
      url: "https://example.supabase.co",
      anonKey: "anon-key",
    });

    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
    if (originalServiceKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceKey;
  });

  it("does not expose a service-role credential in browser source", () => {
    const source = sourceFiles.map((file) => readFileSync(file, "utf8")).join("\n");
    expect(source).not.toMatch(/SERVICE_ROLE|service_role|SUPABASE_SERVICE/);

    const staticDir = join(process.cwd(), ".next", "static");
    if (existsSync(staticDir)) {
      const bundleFiles = readdirSync(staticDir, { recursive: true })
        .filter((file): file is string => typeof file === "string" && file.endsWith(".js"))
        .map((file) => join(staticDir, file));
      const bundles = bundleFiles.map((file) => readFileSync(file, "utf8")).join("\n");
      expect(bundles).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY|service_role/);
    }
  });
});

describe("in-scope listing surfaces", () => {
  it("do not import preview data", () => {
    for (const file of [
      "app/listings/page.tsx",
      "app/search/page.tsx",
      "app/listings/[id]/page.tsx",
      "app/favorites/page.tsx",
    ]) {
      expect(readFileSync(join(process.cwd(), file), "utf8")).not.toContain("lib/data");
    }
  });
});
