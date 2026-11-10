import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE,
  intlLocale,
  isLocale,
  LOCALE_COOKIE,
  LOCALES,
  localeCookie,
  negotiateLocale,
} from "../lib/i18n/config";

describe("locale configuration", () => {
  it("ships Slovenian (default) and English", () => {
    expect(LOCALES).toEqual(["sl", "en"]);
    expect(DEFAULT_LOCALE).toBe("sl");
    expect(isLocale("en")).toBe(true);
    expect(isLocale("de")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });

  it("maps locales to Intl tags with day–month order", () => {
    expect(intlLocale("sl")).toBe("sl-SI");
    expect(intlLocale("en")).toBe("en-GB");
  });

  it("stores the choice for a year on every path", () => {
    expect(localeCookie("en")).toBe(
      `${LOCALE_COOKIE}=en; Path=/; Max-Age=31536000; SameSite=Lax`,
    );
    expect(LOCALE_COOKIE).toBe("roomieslo-locale");
  });
});

describe("negotiateLocale", () => {
  it("lets a valid cookie win over the browser", () => {
    expect(negotiateLocale("en", "sl-SI,sl;q=0.9")).toBe("en");
    expect(negotiateLocale("sl", "en-GB,en;q=0.9")).toBe("sl");
  });

  it("ignores an invalid cookie", () => {
    expect(negotiateLocale("de", "en-US")).toBe("en");
    expect(negotiateLocale("EN", null)).toBe("sl");
    expect(negotiateLocale("", "sl")).toBe("sl");
  });

  it("falls back to Slovenian without a cookie or header", () => {
    expect(negotiateLocale(undefined, undefined)).toBe("sl");
    expect(negotiateLocale(null, "")).toBe("sl");
  });

  it("chooses English only when it ranks above Slovenian", () => {
    expect(negotiateLocale(null, "en-GB,en;q=0.9,sl;q=0.8")).toBe("en");
    expect(negotiateLocale(null, "sl-SI,sl;q=0.9,en;q=0.8")).toBe("sl");
    expect(negotiateLocale(null, "de-DE,de;q=0.9,en;q=0.8")).toBe("en");
    expect(negotiateLocale(null, "de-DE,fr;q=0.9")).toBe("sl");
  });

  it("follows q-values, not just header order", () => {
    expect(negotiateLocale(null, "sl;q=0.5, en;q=0.9")).toBe("en");
    expect(negotiateLocale(null, "en;q=0.4, sl;q=0.6")).toBe("sl");
    expect(negotiateLocale(null, "en;q=0, sl;q=0.1")).toBe("sl");
    expect(negotiateLocale(null, "EN-us;Q=0.9")).toBe("en");
  });

  it("keeps header order for equal quality and tolerates junk", () => {
    expect(negotiateLocale(null, "en, sl")).toBe("en");
    expect(negotiateLocale(null, "sl, en")).toBe("sl");
    expect(negotiateLocale(null, "*;q=1, en;q=abc")).toBe("sl");
    expect(negotiateLocale(null, " , ;q=1")).toBe("sl");
  });
});
