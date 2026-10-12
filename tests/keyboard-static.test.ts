import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Static keyboard/focus rules over the JSX source. They catch regressions that
// need no browser; the Playwright journey in e2e/keyboard.spec.ts covers the rest.
const root = process.cwd();
const sources = ["app", "components"].flatMap((dir) =>
  readdirSync(join(root, dir), { recursive: true })
    .filter(
      (file): file is string =>
        typeof file === "string" && file.endsWith(".tsx"),
    )
    .map((file) => {
      const path = join(root, dir, file);
      return { file: relative(root, path), source: readFileSync(path, "utf8") };
    }),
);
const css = readFileSync(join(root, "app/globals.css"), "utf8");

/** `<button …>text</button>` occurrences whose content is plain text (no JSX). */
function plainButtons(source: string) {
  return [
    ...source.matchAll(/<button\b([^>]*)>\s*([^<{]*?)\s*<\/button>/g),
  ].map(([, attributes, text]) => ({ attributes, text }));
}

describe("keyboard and focus rules", () => {
  it("gives icon-only buttons an accessible name", () => {
    for (const { file, source } of sources) {
      for (const { attributes, text } of plainButtons(source)) {
        if (/\p{L}/u.test(text)) continue; // visible words name the button
        expect(attributes, `${file}: <button>${text}</button>`).toMatch(
          /aria-label=/,
        );
      }
    }
  });

  it("never uses a positive tabIndex", () => {
    for (const { file, source } of sources) {
      expect(source, file).not.toMatch(/tabIndex=\{?["']?[1-9]/);
    }
  });

  it("does not attach click handlers to non-interactive elements", () => {
    for (const { file, source } of sources) {
      expect(source, file).not.toMatch(
        /<(div|span|li|p|section|article)\b[^>]*onClick=/,
      );
    }
  });

  it("keeps a visible focus indicator and does not remove outlines", () => {
    expect(css).toMatch(/:focus-visible\s*\{[^}]*outline:\s*3px solid/);
    expect(css).not.toMatch(/outline:\s*(none|0)\b/);
  });

  it("keeps the skip link first and pointing at the main landmark", () => {
    const shell = sources.find((s) => s.file.endsWith("app-shell.tsx"))!.source;
    expect(shell.indexOf('className="skip-link"')).toBeLessThan(
      shell.indexOf("<aside"),
    );
    expect(shell).toContain('href="#main-content"');
    expect(shell).toMatch(/<main id="main-content"/);
    expect(css).toMatch(/\.skip-link:focus\s*\{[^}]*left:\s*8px/);
  });
});
