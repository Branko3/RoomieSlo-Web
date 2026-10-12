import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "./lib/config";
import {
  createLoginRedirect,
  getRouteAccess,
  requiresSession,
} from "./lib/auth/routes";

export async function middleware(request: NextRequest) {
  const access = getRouteAccess(request.nextUrl.pathname);
  const config = getSupabaseConfig();

  if (!config.configured) {
    // Public routes (including /auth-error itself) stay reachable; redirecting them would loop.
    if (!requiresSession(access)) return NextResponse.next();
    const errorUrl = request.nextUrl.clone();
    errorUrl.pathname = "/auth-error";
    errorUrl.search = "";
    errorUrl.searchParams.set("reason", "configuration");
    return NextResponse.redirect(errorUrl);
  }

  let response = NextResponse.next({ request });
  const client = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookies: Parameters<import("@supabase/ssr").SetAllCookies>[0]) {
        cookies.forEach(({ name, value, options }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookies.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  // A thrown network failure is handled like a session error and never clears cookies.
  const { data, error } = await client.auth
    .getUser()
    .catch((cause: unknown) => ({
      data: { user: null },
      error: cause instanceof Error ? cause : new Error("Session check failed"),
    }));
  const isMissingSession =
    error?.name === "AuthSessionMissingError" ||
    error?.message.toLowerCase().includes("auth session missing");
  if (error && !isMissingSession && requiresSession(access)) {
    const errorUrl = request.nextUrl.clone();
    errorUrl.pathname = "/auth-error";
    errorUrl.search = "";
    errorUrl.searchParams.set("reason", "session");
    return NextResponse.redirect(errorUrl);
  }
  const hasSession = Boolean(data.user);

  if (access === "public" && hasSession) {
    const destination = request.nextUrl.clone();
    destination.pathname = "/listings";
    destination.search = "";
    return NextResponse.redirect(destination);
  }
  if (requiresSession(access) && !hasSession) {
    return NextResponse.redirect(
      new URL(
        createLoginRedirect(request.nextUrl.pathname, request.nextUrl.search),
        request.url,
      ),
    );
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
