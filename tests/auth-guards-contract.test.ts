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

    expect(provider).toContain("client.auth.getSession()");
    expect(provider).toContain("client.auth.onAuthStateChange");
    expect(provider).toContain("data.subscription.unsubscribe()");
    expect(provider).toContain("setPending(false)");
    expect(provider).toContain("if (pending || error) return");
    expect(provider).toContain('if (event === "SIGNED_OUT")');
    expect(provider).toContain("Preverjanje prijave ...");
  });

  it("redirects authenticated auth-entry users and signs out to login", () => {
    const provider = read("components/auth-provider.tsx");
    const login = read("app/login/page.tsx");
    const register = read("app/register/page.tsx");

    expect(provider).toContain('access === "public" && session');
    expect(provider).toContain('router.replace("/listings")');
    expect(provider).toContain('router.replace("/login")');
    expect(login).toContain("client.auth.signInWithPassword");
    expect(register).toContain("client.auth.signUp");
  });

  it("surfaces configuration, session, sign-in, and sign-up failures", () => {
    expect(read("components/auth-provider.tsx")).toContain(
      "Supabase configuration failed.",
    );
    expect(read("components/auth-provider.tsx")).toContain(
      "sessionError.message",
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
