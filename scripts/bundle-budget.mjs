// Checks the gzipped first-load JavaScript of every App Router page against
// perf-budget.json. Run after `npm run build`: `npm run perf:budget`.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

/**
 * The layouts that wrap a page entry, e.g. "/listings/[id]/page" →
 * ["/layout", "/listings/layout", "/listings/[id]/layout"].
 * @param {string} pageEntry
 */
export function layoutChain(pageEntry) {
  const segments = pageEntry
    .replace(/\/page$/, "")
    .split("/")
    .filter(Boolean);
  const chain = ["/layout"];
  for (let i = 1; i <= segments.length; i += 1) {
    chain.push(`/${segments.slice(0, i).join("/")}/layout`);
  }
  return chain;
}

/** "/listings/[id]/page" → "/listings/[id]"; "/page" → "/". @param {string} entry */
export function routeOf(entry) {
  return entry.replace(/\/page$/, "") || "/";
}

/**
 * First-load JS files of each page: the shared root files plus every layout
 * and the page itself, without duplicates.
 * @param {{ rootMainFiles: string[] }} buildManifest
 * @param {{ pages: Record<string, string[]> }} appManifest
 * @returns {Record<string, string[]>}
 */
export function firstLoadFiles(buildManifest, appManifest) {
  /** @type {Record<string, string[]>} */
  const result = {};
  for (const entry of Object.keys(appManifest.pages)) {
    if (!entry.endsWith("/page")) continue;
    const files = new Set(buildManifest.rootMainFiles);
    for (const layout of layoutChain(entry)) {
      for (const file of appManifest.pages[layout] ?? []) files.add(file);
    }
    for (const file of appManifest.pages[entry]) files.add(file);
    result[routeOf(entry)] = [...files].filter((file) => file.endsWith(".js"));
  }
  return result;
}

/**
 * Compares sizes (bytes) with budgets (kB); a route-specific budget overrides
 * the default.
 * @param {Record<string, number>} sizes
 * @param {{ sharedKb: number, defaultRouteKb: number, routes?: Record<string, number> }} budget
 * @param {number} sharedBytes
 */
export function checkBudget(sizes, budget, sharedBytes) {
  const failures = [];
  if (sharedBytes > budget.sharedKb * 1024) {
    failures.push({
      route: "(shared)",
      bytes: sharedBytes,
      limitKb: budget.sharedKb,
    });
  }
  for (const [route, bytes] of Object.entries(sizes)) {
    const limitKb = budget.routes?.[route] ?? budget.defaultRouteKb;
    if (bytes > limitKb * 1024) failures.push({ route, bytes, limitKb });
  }
  return failures;
}

/** @param {string} root */
export function measure(root) {
  const next = join(root, ".next");
  const buildManifest = JSON.parse(
    readFileSync(join(next, "build-manifest.json"), "utf8"),
  );
  const appManifest = JSON.parse(
    readFileSync(join(next, "app-build-manifest.json"), "utf8"),
  );
  /** @type {Map<string, number>} */
  const cache = new Map();
  /** @param {string} file */
  const gz = (file) => {
    if (!cache.has(file))
      cache.set(file, gzipSync(readFileSync(join(next, file))).length);
    return /** @type {number} */ (cache.get(file));
  };
  const sizes = Object.fromEntries(
    Object.entries(firstLoadFiles(buildManifest, appManifest)).map(
      ([route, files]) => [
        route,
        files.reduce((sum, file) => sum + gz(file), 0),
      ],
    ),
  );
  const sharedBytes = buildManifest.rootMainFiles
    .filter((/** @type {string} */ f) => f.endsWith(".js"))
    .reduce(
      (/** @type {number} */ sum, /** @type {string} */ f) => sum + gz(f),
      0,
    );
  return { sizes, sharedBytes };
}

const kb = (/** @type {number} */ bytes) => `${(bytes / 1024).toFixed(1)} kB`;

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const root = process.cwd();
  if (!existsSync(join(root, ".next", "app-build-manifest.json"))) {
    console.error("No build found. Run `npm run build` first.");
    process.exit(2);
  }
  const budget = JSON.parse(
    readFileSync(join(root, "perf-budget.json"), "utf8"),
  );
  const { sizes, sharedBytes } = measure(root);
  console.log(`shared  ${kb(sharedBytes)} (budget ${budget.sharedKb} kB)`);
  for (const [route, bytes] of Object.entries(sizes).sort()) {
    const limit = budget.routes?.[route] ?? budget.defaultRouteKb;
    console.log(
      `${route.padEnd(24)} ${kb(bytes).padStart(9)}  (budget ${limit} kB)`,
    );
  }
  const failures = checkBudget(sizes, budget, sharedBytes);
  for (const f of failures) {
    console.error(`over budget: ${f.route} ${kb(f.bytes)} > ${f.limitKb} kB`);
  }
  process.exit(failures.length ? 1 : 0);
}
