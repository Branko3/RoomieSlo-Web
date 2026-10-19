import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  MIN_RATIO,
  parseHex,
  readTokens,
  resolveColor,
  type ColorMode,
  type ContrastKind,
} from "../lib/a11y/contrast";

const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
const TOKENS_END = "/* ---- END TOKENS ---- */";

/** The `color` declared in the first rule with exactly this selector. */
function ruleColor(selector: string, property = "color"): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rule = new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  if (!rule) throw new Error(`No rule for ${selector}`);
  const value = new RegExp(`(?:^|[;\\s])${property}:\\s*([^;]+);`).exec(
    rule[1],
  );
  if (!value) throw new Error(`No ${property} in ${selector}`);
  return value[1].trim();
}

const SURFACES = [
  "var(--color-bg)",
  "var(--color-surface)",
  "var(--color-surface-sunken)",
  "var(--color-surface-accent)",
];

/** [name, foreground, background, kind]; colours are tokens or rule lookups. */
const CASES: Array<[string, string, string, ContrastKind]> = [
  // Body, secondary and accent text plus the focus ring on every surface.
  ...SURFACES.flatMap(
    (bg) =>
      [
        [`text on ${bg}`, "var(--color-text)", bg, "text"],
        [`muted on ${bg}`, "var(--color-text-muted)", bg, "text"],
        [`accent text on ${bg}`, "var(--color-text-accent)", bg, "text"],
        [`focus ring on ${bg}`, "var(--color-focus)", bg, "ui"],
      ] as Array<[string, string, string, ContrastKind]>,
  ),
  [
    "muted on photo placeholder",
    "var(--color-text-muted)",
    "var(--color-photo)",
    "text",
  ],
  [
    "button text on action",
    "var(--color-on-action)",
    "var(--color-action)",
    "text",
  ],
  ["action on surface", "var(--color-action)", "var(--color-surface)", "ui"],
  [
    "input border on surface",
    "var(--color-border-input)",
    "var(--color-surface)",
    "ui",
  ],
  [
    "attention text",
    "var(--color-attention-text)",
    "var(--color-attention-surface)",
    "text",
  ],
  ["danger on surface", "var(--color-danger)", "var(--color-surface)", "text"],
  [
    "danger on danger surface",
    "var(--color-danger)",
    "var(--color-danger-surface)",
    "text",
  ],
  [
    "on-danger on danger",
    "var(--color-on-danger)",
    "var(--color-danger)",
    "text",
  ],
  ["toast text", "var(--color-on-toast)", "var(--color-toast)", "text"],
  ["hero text", ruleColor(".hero-banner p"), "var(--color-hero)", "text"],
  [
    "hero focus ring",
    ruleColor(".hero-banner :focus-visible", "outline-color"),
    "var(--color-hero)",
    "ui",
  ],
  ["sidebar links", ruleColor(".nav-link"), "var(--color-surface)", "text"],
  [
    "active nav",
    "var(--color-text-accent)",
    "var(--color-surface-accent)",
    "text",
  ],
  [
    "liked heart on surface",
    ruleColor(".heart-button.liked"),
    "var(--color-surface)",
    "ui",
  ],
  [
    "tear-strip price on surface",
    ruleColor(".tear-strip .tear-price"),
    "var(--color-surface)",
    "text",
  ],
];

describe("contrast helpers", () => {
  it("computes WCAG ratios", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
    expect(contrastRatio("#fff", "#000")).toBe(contrastRatio("#000", "#fff"));
  });

  it("parses and resolves colors through var() chains per mode", () => {
    expect(parseHex("#2f6f5e")).toEqual([47, 111, 94]);
    expect(parseHex("#fff")).toEqual([255, 255, 255]);
    expect(() => parseHex("red")).toThrow();
    const sample = `:root { --a: #111111; --b: var(--a); }
      @media (prefers-color-scheme: dark) { :root { --b: #eeeeee; } }`;
    expect(readTokens(sample, "light").b).toBe("#111111");
    expect(readTokens(sample, "dark").b).toBe("#eeeeee");
    const light = readTokens(css);
    expect(resolveColor("var(--color-action)", light)).toBe("#2f6f5e");
    expect(resolveColor("white", light)).toBe("#ffffff");
    expect(() => resolveColor("var(--nope)", light)).toThrow();
  });
});

for (const mode of ["light", "dark"] as ColorMode[]) {
  describe(`design token contrast, ${mode} mode (app/globals.css)`, () => {
    const tokens = readTokens(css, mode);
    for (const [name, fg, bg, kind] of CASES) {
      it(`${name} meets ${MIN_RATIO[kind]}:1`, () => {
        const ratio = contrastRatio(
          resolveColor(fg, tokens),
          resolveColor(bg, tokens),
        );
        expect(ratio).toBeGreaterThanOrEqual(MIN_RATIO[kind]);
      });
    }
  });
}

describe("token layering", () => {
  it("draws the focus indicator with the focus token", () => {
    expect(css).toMatch(
      /:focus-visible\s*\{\s*outline:\s*3px solid var\(--color-focus\)/,
    );
  });

  it("keeps raw hex colours inside the token layer only", () => {
    const [tokenLayer, rules] = css.split(TOKENS_END);
    expect(rules, "END TOKENS marker missing").toBeDefined();
    expect(tokenLayer).toContain("prefers-color-scheme: dark");
    expect(rules.match(/#[0-9a-f]{3,8}\b/gi) ?? []).toEqual([]);
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
