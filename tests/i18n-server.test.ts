import { beforeEach, describe, expect, it, vi } from "vitest";

const request = vi.hoisted(() => ({
  cookie: undefined as string | undefined,
  acceptLanguage: null as string | null,
}));

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) =>
      name === "roomieslo-locale" && request.cookie !== undefined
        ? { name, value: request.cookie }
        : undefined,
  }),
  headers: () => ({
    get: (name: string) =>
      name === "accept-language" ? request.acceptLanguage : null,
  }),
}));

import { getI18n, getLocale } from "../lib/i18n/server";
import { catalogs } from "../lib/i18n/messages";

describe("server locale", () => {
  beforeEach(() => {
    request.cookie = undefined;
    request.acceptLanguage = null;
  });

  it("defaults to Slovenian", async () => {
    expect(await getLocale()).toBe("sl");
    const { locale, m } = await getI18n();
    expect(locale).toBe("sl");
    expect(m).toBe(catalogs.sl);
  });

  it("follows the browser without a cookie, and the cookie over the browser", async () => {
    request.acceptLanguage = "en-GB,en;q=0.9";
    expect(await getLocale()).toBe("en");
    request.cookie = "sl";
    expect(await getLocale()).toBe("sl");
  });

  it("returns the English catalog and formatters for English", async () => {
    request.cookie = "en";
    const i18n = await getI18n();
    expect(i18n.m.shell.nav.favorites).toBe("Favourites");
    expect(i18n.formatters.currency(1250)).toBe("€1,250");
  });
});
