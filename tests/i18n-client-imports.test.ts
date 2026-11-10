import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// The catalogs reach the browser as JSON through the root layout's
// I18nProvider. A client module that imports them would ship every language in
// its JavaScript chunk and blow the first-load budget, so only server code may
// import lib/i18n/messages (types from lib/i18n/types are fine).
const root = process.cwd();

function sources(dir: string) {
  return readdirSync(join(root, dir), { recursive: true })
    .filter(
      (file): file is string =>
        typeof file === "string" && /\.(ts|tsx)$/.test(file),
    )
    .map((file) => {
      const path = join(root, dir, file);
      return {
        file: relative(root, path).split("\\").join("/"),
        source: readFileSync(path, "utf8"),
      };
    });
}

const files = ["app", "components", "lib"].flatMap(sources);
const IMPORT = /(?:import|export)\s+(type\s+)?[^;]*?from\s+["']([^"']+)["']/g;

function catalogImports(source: string) {
  return [...source.matchAll(IMPORT)]
    .filter(([, typeOnly, specifier]) => {
      if (typeOnly) return false;
      return /(^|\/)i18n\/messages(\/|$)/.test(specifier);
    })
    .map(([, , specifier]) => specifier);
}

function isClientModule(file: string, source: string) {
  return (
    /^\s*["']use client["']/.test(source) ||
    (file.startsWith("components/") && !file.endsWith(".server.tsx"))
  );
}

describe("catalog imports", () => {
  it("finds the client modules it guards", () => {
    const client = files.filter(({ file, source }) =>
      isClientModule(file, source),
    );
    expect(client.map(({ file }) => file)).toContain("lib/i18n/provider.tsx");
    expect(client.length).toBeGreaterThan(20);
  });

  it("keeps lib/i18n/messages out of client components", () => {
    for (const { file, source } of files) {
      if (!isClientModule(file, source)) continue;
      expect(catalogImports(source), file).toEqual([]);
    }
  });

  it("recognises catalog imports", () => {
    expect(
      catalogImports(
        [
          'import { en } from "../lib/i18n/messages/en";',
          'import { getMessages } from "../../lib/i18n/messages";',
          'import type { Messages } from "../lib/i18n/types";',
          'import type { sl } from "./messages/sl";',
          'import { useI18n } from "../lib/i18n/provider";',
        ].join("\n"),
      ),
    ).toEqual(["../lib/i18n/messages/en", "../../lib/i18n/messages"]);
  });
});
