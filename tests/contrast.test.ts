import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  MIN_RATIO,
  parseHex,
  readTokens,
  resolveColor,
  type ContrastKind,
} from "../lib/a11y/contrast";

const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
const tokens = readTokens(css);

/** The `color` declared in the first rule with exactly this selector. */
function ruleColor(selector: string, property = "color"): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rule = new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  if (!rule) throw new Error(`No rule for ${selector}`);
  const value = new RegExp(`(?:^|[;\\s])${property}:\\s*([^;]+);`).exec(
    rule[1],
  );
  if (!value) throw new Error(`No ${property} in ${selector}`);
  return resolveColor(value[1], tokens);
}

const LIGHT_SURFACES = {
  surface: "var(--surface)",
  background: "var(--background)",
  "green-light": "var(--green-light)",
  "listing gradient start": "#d8ece0",
  "listing gradient end": "#f6e8c9",
} as const;

describe("contrast helpers", () => {
  it("computes WCAG ratios", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
    expect(contrastRatio("#fff", "#000")).toBe(contrastRatio("#000", "#fff"));
  });

  it("parses and resolves colors", () => {
    expect(parseHex("#2f6f5e")).toEqual([47, 111, 94]);
    expect(parseHex("#fff")).toEqual([255, 255, 255]);
    expect(() => parseHex("red")).toThrow();
    expect(resolveColor("var(--green)", tokens)).toBe("#2f6f5e");
    expect(resolveColor("white", tokens)).toBe("#ffffff");
    expect(() => resolveColor("var(--nope)", tokens)).toThrow();
  });
});

describe("design token contrast (app/globals.css)", () => {
  const cases: Array<[string, string, string, ContrastKind]> = [
    // Body and secondary text on every light surface.
    ...Object.entries(LIGHT_SURFACES).flatMap(
      ([name, bg]) =>
        [
          [`ink on ${name}`, "var(--ink)", bg, "text"],
          [`muted on ${name}`, "var(--muted)", bg, "text"],
          [`green-dark on ${name}`, "var(--green-dark)", bg, "text"],
          [`focus ring on ${name}`, "var(--focus-ring)", bg, "ui"],
        ] as Array<[string, string, string, ContrastKind]>,
    ),
    ["button text on green", "#ffffff", "var(--green)", "text"],
    [
      "active nav on green-light",
      "var(--green-dark)",
      "var(--green-light)",
      "text",
    ],
    ["hero text on green", ruleColor(".hero-banner p"), "var(--green)", "text"],
    [
      "hero eyebrow on green",
      ruleColor(".hero-banner .eyebrow"),
      "var(--green)",
      "text",
    ],
    ["hero focus ring on green", "#ffffff", "var(--green)", "ui"],
    ["sidebar links", ruleColor(".nav-link"), "var(--surface)", "text"],
    [
      "liked heart on surface",
      ruleColor(".heart-button.liked"),
      "var(--surface)",
      "ui",
    ],
    [
      "static heart on background",
      ruleColor(".heart-static"),
      "var(--background)",
      "ui",
    ],
  ];

  for (const [name, fg, bg, kind] of cases) {
    it(`${name} meets ${MIN_RATIO[kind]}:1`, () => {
      const ratio = contrastRatio(
        resolveColor(fg, tokens),
        resolveColor(bg, tokens),
      );
      expect(ratio).toBeGreaterThanOrEqual(MIN_RATIO[kind]);
    });
  }

  it("draws the focus indicator with the focus-ring token, not amber", () => {
    expect(css).toMatch(
      /:focus-visible\s*\{\s*outline:\s*3px solid var\(--focus-ring\)/,
    );
    expect(css).toMatch(
      /\.hero-banner :focus-visible\s*\{\s*outline-color:\s*#fff/,
    );
  });

  it("does not hard-code the old low-contrast greys", () => {
    for (const old of [
      "#70807a",
      "#7a8983",
      "#cae7db",
      "#aee2ce",
      "#da7777",
      "#d97777",
    ]) {
      expect(css.toLowerCase()).not.toContain(old);
    }
  });
});
