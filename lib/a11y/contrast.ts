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

/** Reads `--name: #hex;` custom properties from a stylesheet. */
export function readTokens(css: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const [, name, value] of css.matchAll(
    /--([\w-]+):\s*(#[0-9a-f]{3,6})\b/gi,
  )) {
    tokens[name] = value;
  }
  return tokens;
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
