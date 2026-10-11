/**
 * Structured, privacy-safe error reports for log-based monitoring. One JSON
 * line per error so a log drain or the hosting platform's log search can count
 * and alert on `event: "client_error"`.
 *
 * Only the error name, Next.js digest, and the route pattern are kept: the
 * message and stack can contain user input, and ids in the path are masked.
 */

export type ErrorReport = {
  event: "client_error";
  boundary: "page" | "global";
  name: string;
  digest: string | null;
  route: string;
  version: string;
};

const ID_SEGMENT =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+)$/i;

/** "/listings/2f0c…-…/x?y=1" → "/listings/:id/x" (query and hash dropped). */
export function maskRoute(pathname: string): string {
  const path = pathname.split(/[?#]/)[0] || "/";
  return path
    .split("/")
    .map((segment) => (ID_SEGMENT.test(segment) ? ":id" : segment))
    .join("/");
}

export function buildErrorReport(
  error: { name?: string; digest?: string },
  boundary: ErrorReport["boundary"],
  pathname: string,
  version: string,
): ErrorReport {
  return {
    event: "client_error",
    boundary,
    name: error.name || "Error",
    digest: error.digest ?? null,
    route: maskRoute(pathname),
    version,
  };
}

export function reportError(
  error: { name?: string; digest?: string },
  boundary: ErrorReport["boundary"],
  sink: (line: string) => void = (line) => console.error(line),
): void {
  const pathname =
    typeof window === "undefined" ? "/" : window.location.pathname;
  const version = process.env.NEXT_PUBLIC_APP_VERSION?.slice(0, 12) || "dev";
  sink(JSON.stringify(buildErrorReport(error, boundary, pathname, version)));
}
