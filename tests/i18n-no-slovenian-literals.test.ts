import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * User-visible text lives in `lib/i18n/messages/`. A Slovenian letter in a
 * string or JSX literal anywhere else is almost always untranslated UI text,
 * so new ones fail here unless they are stored values listed below.
 */
const ROOT = join(__dirname, "..");
const SCANNED = ["app", "components", "lib"];
const SKIPPED = ["lib/i18n/messages/", "lib/data.ts"];
const SLOVENIAN = /[čšžČŠŽ]/;

/** Literals that must stay Slovenian, by file. */
const ALLOWED: Record<string, string[]> = {
  // Renders outside the root layout, so it carries both languages itself.
  "app/global-error.tsx": ["RoomieSlo trenutno ni na voljo", "Osveži stran"],
  // District names are proper names and stored values.
  "lib/listings/listing-form.ts": [
    "Bežigrad",
    "Šiška",
    "Vič",
    "Rožna dolina",
    "Črnuče",
  ],
  // Report reasons are stored in Slovenian and shared with Android.
  "lib/reports/report.ts": ["Lažen profil ali oglas"],
};

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

/** Removes comments so Slovenian terms quoted in documentation don't count. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}

/** String, template and JSX-text literals that contain a Slovenian letter. */
function slovenianLiterals(source: string): string[] {
  const code = stripComments(source);
  const found: string[] = [];
  const patterns = [
    /"([^"\n]*)"/g,
    /'([^'\n]*)'/g,
    /`([^`]*)`/g,
    />([^<>{}]+)</g,
  ];
  for (const pattern of patterns) {
    for (const match of code.matchAll(pattern)) {
      const text = match[1].trim();
      if (SLOVENIAN.test(text)) found.push(text);
    }
  }
  return found;
}

describe("Slovenian literals outside the catalogs", () => {
  const files = SCANNED.flatMap((dir) => sourceFiles(join(ROOT, dir)))
    .map((path) => relative(ROOT, path).split(sep).join("/"))
    .filter((path) => !SKIPPED.some((skip) => path.startsWith(skip)));

  it("scans the application sources", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("finds none apart from the allowed stored values", () => {
    const offenders = files.flatMap((path) => {
      const allowed = ALLOWED[path] ?? [];
      return slovenianLiterals(readFileSync(join(ROOT, path), "utf8"))
        .filter((text) => !allowed.includes(text))
        .map((text) => `${path}: ${text}`);
    });
    expect(offenders).toEqual([]);
  });

  it("catches a JSX text or string literal", () => {
    expect(slovenianLiterals("<p>Shrani spremembe in začni</p>")).toEqual([
      "Shrani spremembe in začni",
    ]);
    expect(slovenianLiterals('const a = "Izbriši"; // Izbriši')).toEqual([
      "Izbriši",
    ]);
    expect(slovenianLiterals("/** Moji oglasi: Živiva skupaj */")).toEqual([]);
  });
});
