import { describe, expect, it } from "vitest";
import { LOCALES } from "../lib/i18n/config";
import { catalogs } from "../lib/i18n/messages";
import { en } from "../lib/i18n/messages/en";
import { sl } from "../lib/i18n/messages/sl";

// Generic parity checks over every namespace, including the ones filled later.
// The type system already rejects a missing or extra English key; these checks
// cover what types cannot see: placeholders, plural forms and empty strings.

const PLURAL_KEYS = new Set(["one", "two", "few", "other"]);

type Entry =
  | { kind: "text"; value: string }
  | { kind: "plural"; forms: Record<string, string> };

function isPlural(value: object): value is Record<string, string> {
  const keys = Object.keys(value);
  return (
    keys.includes("other") &&
    keys.every(
      (key) =>
        PLURAL_KEYS.has(key) &&
        typeof (value as Record<string, unknown>)[key] === "string",
    )
  );
}

/** Flattens a catalog to "path → entry"; reports values that are not JSON text. */
function flatten(
  node: unknown,
  path: string,
  out: Map<string, Entry>,
  problems: string[],
): Map<string, Entry> {
  if (typeof node === "string") {
    out.set(path, { kind: "text", value: node });
  } else if (node && typeof node === "object" && !Array.isArray(node)) {
    if (path && isPlural(node)) {
      out.set(path, { kind: "plural", forms: node });
    } else {
      for (const [key, value] of Object.entries(node)) {
        flatten(value, path ? `${path}.${key}` : key, out, problems);
      }
    }
  } else {
    problems.push(`${path}: ${typeof node} is not a string or plural object`);
  }
  return out;
}

function placeholders(text: string): string[] {
  return [
    ...new Set([...text.matchAll(/\{(\w+)\}/g)].map(([, n]) => n)),
  ].sort();
}

function entryPlaceholders(entry: Entry): string[] {
  if (entry.kind === "text") return placeholders(entry.value);
  // `{count}` may be spelled out in a form ("en oglas"); the rest must agree.
  return [
    ...new Set(
      Object.values(entry.forms).flatMap((form) => placeholders(form)),
    ),
  ]
    .filter((name) => name !== "count")
    .sort();
}

/** Every problem that makes `translation` differ from `source`. */
function compareCatalogs(
  source: unknown,
  translation: unknown,
  sourceForms: readonly string[] = ["one", "two", "few", "other"],
): string[] {
  const problems: string[] = [];
  const a = flatten(source, "", new Map(), problems);
  const b = flatten(translation, "", new Map(), problems);
  for (const [path, entry] of a) {
    if (!b.has(path)) problems.push(`${path}: missing translation`);
    if (entry.kind === "plural") {
      for (const form of sourceForms) {
        if (!entry.forms[form]) problems.push(`${path}: missing "${form}"`);
      }
    }
  }
  for (const [path, entry] of b) {
    const original = a.get(path);
    if (!original) {
      problems.push(`${path}: not in the source catalog`);
      continue;
    }
    if (original.kind !== entry.kind) {
      problems.push(`${path}: ${original.kind} vs ${entry.kind}`);
      continue;
    }
    if (entry.kind === "plural" && !entry.forms.one) {
      problems.push(`${path}: missing "one"`);
    }
    const expected = entryPlaceholders(original).join(",");
    const actual = entryPlaceholders(entry).join(",");
    if (expected !== actual) {
      problems.push(`${path}: placeholders {${expected}} vs {${actual}}`);
    }
  }
  for (const [path, entry] of [...a, ...b]) {
    const texts =
      entry.kind === "text" ? [entry.value] : Object.values(entry.forms);
    if (texts.some((text) => text.trim() === "")) {
      problems.push(`${path}: empty string`);
    }
  }
  return problems;
}

describe("catalog parity", () => {
  it("exposes one catalog per locale with every namespace", () => {
    expect(Object.keys(catalogs).sort()).toEqual([...LOCALES].sort());
    expect(Object.keys(sl)).toEqual([
      "common",
      "shell",
      "errors",
      "auth",
      "account",
      "privacy",
      "profile",
      "questionnaire",
      "ratings",
      "cohabitation",
      "listings",
      "search",
      "favorites",
      "matching",
      "chat",
      "reports",
      "admin",
    ]);
    expect(Object.keys(en)).toEqual(Object.keys(sl));
  });

  it("gives English the same keys, placeholders and complete plurals", () => {
    expect(compareCatalogs(sl, sl)).toEqual([]);
    expect(compareCatalogs(sl, en)).toEqual([]);
  });

  it("survives a JSON round trip (it is sent to the client as RSC data)", () => {
    for (const catalog of Object.values(catalogs)) {
      expect(JSON.parse(JSON.stringify(catalog))).toEqual(catalog);
    }
  });
});

describe("compareCatalogs", () => {
  const source = {
    a: { title: "Živjo, {name}", body: "Besedilo" },
    count: {
      one: "{count} oglas",
      two: "{count} oglasa",
      few: "{count} oglasi",
      other: "{count} oglasov",
    },
  };

  it("accepts a faithful translation", () => {
    expect(
      compareCatalogs(source, {
        a: { title: "Hi, {name}", body: "Text" },
        count: { one: "one listing", other: "{count} listings" },
      }),
    ).toEqual([]);
  });

  it("reports missing and extra keys, placeholders and empty text", () => {
    expect(
      compareCatalogs(source, {
        a: { title: "Hi, {user}", extra: "x" },
        count: { other: "" },
      }),
    ).toEqual([
      "a.body: missing translation",
      "a.title: placeholders {name} vs {user}",
      "a.extra: not in the source catalog",
      'count: missing "one"',
      "count: empty string",
    ]);
    expect(compareCatalogs(source, { ...source, count: "listings" })).toEqual([
      "count: plural vs text",
    ]);
  });

  it("reports incomplete plurals and non-text values", () => {
    expect(
      compareCatalogs(
        { n: { one: "{count} x", other: "{count} y" }, f: "x" },
        { n: { two: "{count} y", other: "{count} y" }, f: 3 },
      ),
    ).toEqual([
      "f: number is not a string or plural object",
      'n: missing "two"',
      'n: missing "few"',
      "f: missing translation",
      'n: missing "one"',
    ]);
  });
});
