import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "./lib/config";
import { createLoginRedirect, getRouteAccess } from "./lib/auth/routes";

export async function middleware(request: NextRequest) {
  const access = getRouteAccess(request.nextUrl.pathname);
  const config = getSupabaseConfig();

  if (!config.configured) {
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
  const { data, error } = await client.auth.getUser();
  const isMissingSession =
    error?.name === "AuthSessionMissingError" ||
    error?.message.toLowerCase().includes("auth session missing");
  if (error && !isMissingSession && access !== "public") {
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
  if (access !== "public" && !hasSession) {
    const destination = request.nextUrl.clone();
    destination.pathname = createLoginRedirect(
      request.nextUrl.pathname,
      request.nextUrl.search,
    ).split("?")[0];
    destination.search =
      createLoginRedirect(
        request.nextUrl.pathname,
        request.nextUrl.search,
      ).split("?")[1] || "";
    return NextResponse.redirect(destination);
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
