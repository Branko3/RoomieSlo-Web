import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => readFileSync(join(root, file), "utf8");

describe("route guard implementation contract", () => {
  it("enforces centralized access classification and middleware session checks", () => {
    const middleware = read("middleware.ts");

    expect(middleware).toContain("getRouteAccess(request.nextUrl.pathname)");
    expect(middleware).toContain("client.auth.getUser()");
    expect(middleware).toContain("createLoginRedirect(");
    expect(middleware).toContain('access === "public" && hasSession');
    expect(middleware).toContain('access !== "public" && !hasSession');
    expect(middleware).toContain('reason", "configuration"');
    expect(middleware).toContain('reason", "session"');
  });

  it("preserves nested pathname and query state for protected redirects", () => {
    const middleware = read("middleware.ts");

    expect(middleware).toContain("request.nextUrl.pathname");
    expect(middleware).toContain("request.nextUrl.search");
    expect(read("lib/auth/routes.ts")).toContain(
      "encodeURIComponent(destination)",
    );
  });

  it("restores sessions, listens for auth changes, and blocks protected flashes", () => {
    const provider = read("components/auth-provider.tsx");

    // Session restore and auth-change wiring is unit-tested through initializeAuthSession
    // in tests/email-password-login.test.ts.
    expect(provider).toContain("initializeAuthSession(client, {");
    expect(provider).toContain("setLoading: setPending");
    expect(provider).toContain("if (pending || error) return");
    expect(provider).toContain('if (event === "SIGNED_OUT")');
    expect(provider).toContain("Preverjanje prijave ...");
  });

  it("redirects authenticated auth-entry users and signs out to login", () => {
    const provider = read("components/auth-provider.tsx");
    const login = read("app/login/page.tsx");
    const register = read("app/register/page.tsx");

    expect(provider).toContain('access === "public" && session');
    expect(provider).toContain("router.replace(getSafeReturnPath(returnTo))");
    expect(provider).toContain('onSignedOut: () => router.replace("/login")');
    expect(provider).toContain("client.auth.signInWithPassword");
    expect(login).toContain("signIn(validation.email, password)");
    expect(register).toMatch(/\.auth\.signUp\(/);
  });

  it("surfaces configuration, session, sign-in, and sign-up failures", () => {
    expect(read("components/auth-provider.tsx")).toContain(
      "Supabase configuration failed.",
    );
    // Raw Supabase messages are not shown; a fixed Slovenian message is.
    expect(read("components/auth-provider.tsx")).toContain(
      "Seje ni mogoče preveriti.",
    );
    expect(read("app/login/page.tsx")).toContain('role="alert"');
    expect(read("app/register/page.tsx")).toContain('role="alert"');
    expect(read("app/auth-error/page.tsx")).toContain(
      "NEXT_PUBLIC_SUPABASE_URL",
    );
  });
});

describe("admin and indexing contract", () => {
  it("uses the RLS-backed admins query and renders denied and error states", () => {
    const admin = read("app/admin/reports/page.tsx");

    expect(admin).toContain('from("admins")');
    expect(admin).toContain('.select("user_id")');
    expect(admin).toContain('.eq("user_id", session.user.id)');
    expect(admin).toContain("maybeSingle()");
    expect(admin).toContain("Dostop zavrnjen");
    expect(admin).toContain('role="alert"');
    expect(admin).toContain("queryError.message");
  });

  it("marks authenticated application and auth-error content noindex", () => {
    expect(read("app/layout.tsx")).toContain(
      "robots: { index: false, follow: false }",
    );
    expect(read("app/auth-error/page.tsx")).toContain(
      "robots: { index: false, follow: false }",
    );
  });
});

describe("route guard configuration fallback", () => {
  it("keeps public routes reachable without Supabase configuration (no /auth-error loop)", () => {
    const middleware = read("middleware.ts");
    const unconfigured = middleware.slice(
      middleware.indexOf("if (!config.configured)"),
      middleware.indexOf('reason", "configuration"'),
    );

    expect(unconfigured).toContain(
      'if (access === "public") return NextResponse.next();',
    );
    expect(read("lib/auth/routes.ts")).toContain('"/auth-error"');
  });
});
