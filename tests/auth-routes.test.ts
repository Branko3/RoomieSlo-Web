import { describe, expect, it } from "vitest";
import {
  createLoginRedirect,
  getRouteAccess,
  getSafeReturnPath,
} from "../lib/auth/routes";

describe("auth route guards", () => {
  it("classifies public, protected, dynamic and admin routes", () => {
    expect(getRouteAccess("/login")).toBe("public");
    expect(getRouteAccess("/register")).toBe("public");
    expect(getRouteAccess("/listings/abc")).toBe("auth");
    expect(getRouteAccess("/academic-verification")).toBe("auth");
    expect(getRouteAccess("/admin/reports")).toBe("admin");
    expect(getRouteAccess("/admin/reports/monthly")).toBe("admin");
    expect(getRouteAccess("/login/help")).toBe("public");
    expect(getRouteAccess("/admin")).toBe("auth");
  });
  it("preserves only safe internal return paths", () => {
    expect(
      getSafeReturnPath(encodeURIComponent("/search?location=Ljubljana")),
    ).toBe("/search?location=Ljubljana");
    expect(getSafeReturnPath("https://evil.example")).toBe("/listings");
    expect(getSafeReturnPath("//evil.example/path")).toBe("/listings");
    expect(getSafeReturnPath("/\\evil.example")).toBe("/listings");
    expect(getSafeReturnPath("/safe%0AHeader")).toBe("/listings");
    expect(getSafeReturnPath("/safe%5C%5Cpath")).toBe("/listings");
    expect(getSafeReturnPath("%")).toBe("/listings");
    expect(getSafeReturnPath("/safe#section")).toBe("/safe#section");
    expect(getSafeReturnPath("%E0%A4%A")).toBe("/listings");
    expect(getSafeReturnPath(null)).toBe("/listings");
  });
  it("encodes pathname and query in the login redirect", () => {
    expect(createLoginRedirect("/search", "?q=rooms")).toBe(
      "/login?returnTo=%2Fsearch%3Fq%3Drooms",
    );
  });
});
