export type RouteAccess = "public" | "auth" | "admin";

const publicRoutes = ["/login", "/register", "/auth-error"];
const adminRoutes = ["/admin/reports"];

export function getRouteAccess(pathname: string): RouteAccess {
  const path = normalizePath(pathname);
  if (
    adminRoutes.some((route) => path === route || path.startsWith(`${route}/`))
  ) {
    return "admin";
  }
  if (
    publicRoutes.some((route) => path === route || path.startsWith(`${route}/`))
  ) {
    return "public";
  }
  return "auth";
}

export function normalizePath(pathname: string): string {
  if (!pathname || !pathname.startsWith("/")) return "/";
  return pathname.replace(/\/{2,}/g, "/") || "/";
}

export function getSafeReturnPath(value: string | null | undefined): string {
  if (!value) return "/listings";
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return "/listings";
  }
  if (
    !decoded.startsWith("/") ||
    decoded.startsWith("//") ||
    decoded.includes("\\") ||
    decoded.includes("\r") ||
    decoded.includes("\n")
  ) {
    return "/listings";
  }
  try {
    const url = new URL(decoded, "http://roomieslo.local");
    if (url.origin !== "http://roomieslo.local") return "/listings";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/listings";
  }
}

export function createLoginRedirect(pathname: string, search = ""): string {
  const destination = `${normalizePath(pathname)}${search}`;
  return `/login?returnTo=${encodeURIComponent(destination)}`;
}
