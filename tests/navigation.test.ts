import { describe, expect, it } from "vitest";
import { activeSection, NAV_ITEMS } from "../lib/navigation";
import { catalogs } from "../lib/i18n/messages";

describe("activeSection", () => {
  it("uses the first path segment", () => {
    expect(activeSection("/chats")).toBe("chats");
    expect(activeSection("/listings/abc")).toBe("listings");
  });

  it("treats the root and a missing pathname as listings", () => {
    expect(activeSection("/")).toBe("listings");
    expect(activeSection("")).toBe("listings");
    expect(activeSection(null)).toBe("listings");
  });
});

describe("NAV_ITEMS", () => {
  it("lists every main section once, in order, with a label", () => {
    expect(NAV_ITEMS.map(([route]) => route)).toEqual([
      "listings",
      "search",
      "chats",
      "favorites",
      "profile",
    ]);
    for (const [route, icon] of NAV_ITEMS) {
      expect(icon).not.toBe("");
      for (const messages of Object.values(catalogs)) {
        expect(messages.shell.nav[route]).not.toBe("");
      }
    }
  });
});
