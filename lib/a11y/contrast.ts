/** WCAG 2.x contrast helpers used by the design-token audit. */

export type Rgb = [number, number, number];

export function parseHex(color: string): Rgb {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!match) throw new Error(`Not a hex color: ${color}`);
  const hex =
    match[1].length === 3 ? [...match[1]].map((c) => c + c).join("") : match[1];
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
}

/** Relative luminance (WCAG 2.x definition). */
export function luminance(color: string): number {
  const [r, g, b] = parseHex(color).map((value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio between two colors, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/**
 * Minimum ratios: 4.5:1 for normal text and 3:1 for large text (at least 24px,
 * or 18.66px bold) and for UI components and focus indicators (1.4.3 and 1.4.11).
 */
export const MIN_RATIO = { text: 4.5, large: 3, ui: 3 } as const;
export type ContrastKind = keyof typeof MIN_RATIO;

export type ColorMode = "light" | "dark";

/** Every dark-mode block, however it is spaced. */
const DARK_QUERY = /@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)/gi;

/** The body of the `{ … }` block that opens at or after `start`. */
function blockBody(css: string, start: number): { body: string; end: number } {
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    if (css[i] === "}" && --depth === 0) {
      return { body: css.slice(open + 1, i), end: i + 1 };
    }
  }
  throw new Error("Unbalanced braces in stylesheet");
}

/**
 * `--name: value;` pairs (hex or `var(--other)`) in declaration order. Hex of
 * any length is captured, so a form `parseHex` cannot read (#rgba, #rrggbbaa)
 * fails loudly when used instead of silently vanishing.
 */
function declarations(css: string): Array<[string, string]> {
  return [
    ...css.matchAll(/--([\w-]+):\s*(#[0-9a-f]{3,8}\b|var\(--[\w-]+\))/gi),
  ].map(([, name, value]) => [name, value]);
}

/**
 * Reads colour custom properties from a stylesheet and resolves `var()`
 * chains down to hex. Light mode ignores every prefers-color-scheme: dark
 * block; dark mode applies them, in order, on top of the light values.
 */
export function readTokens(
  css: string,
  mode: ColorMode = "light",
): Record<string, string> {
  let base = "";
  let dark = "";
  let cursor = 0;
  for (const match of css.matchAll(DARK_QUERY)) {
    const start = match.index ?? 0;
    if (start < cursor) continue;
    const { body, end } = blockBody(css, start);
    base += css.slice(cursor, start);
    dark += `${body}\n`;
    cursor = end;
  }
  base += css.slice(cursor);
  const raw: Record<string, string> = {};
  for (const [name, value] of declarations(base)) raw[name] = value;
  if (mode === "dark") {
    for (const [name, value] of declarations(dark)) raw[name] = value;
  }
  const resolved: Record<string, string> = {};
  for (const name of Object.keys(raw)) {
    let value = raw[name];
    for (let hops = 0; value.startsWith("var("); hops += 1) {
      const next = raw[value.slice(6, -1)];
      if (!next || hops > 10) break;
      value = next;
    }
    if (value.startsWith("#")) resolved[name] = value;
  }
  return resolved;
}

/** Resolves `var(--token)`, `white`, or a hex color. */
export function resolveColor(
  value: string,
  tokens: Record<string, string>,
): string {
  const trimmed = value.trim();
  const token = /^var\(--([\w-]+)\)$/.exec(trimmed);
  if (token) {
    const resolved = tokens[token[1]];
    if (!resolved) throw new Error(`Unknown token --${token[1]}`);
    return resolved;
  }
  if (trimmed === "white") return "#ffffff";
  return trimmed;
}
