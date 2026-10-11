// Types for importing bundle-budget.mjs from TypeScript tests.
export function layoutChain(pageEntry: string): string[];
export function routeOf(entry: string): string;
export function firstLoadFiles(
  buildManifest: { rootMainFiles: string[] },
  appManifest: { pages: Record<string, string[]> },
): Record<string, string[]>;
export type BudgetFailure = { route: string; bytes: number; limitKb: number };
export function checkBudget(
  sizes: Record<string, number>,
  budget: {
    sharedKb: number;
    defaultRouteKb: number;
    routes?: Record<string, number>;
  },
  sharedBytes: number,
): BudgetFailure[];
export function measure(root: string): {
  sizes: Record<string, number>;
  sharedBytes: number;
};
