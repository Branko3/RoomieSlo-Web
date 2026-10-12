import { describe, expect, it } from "vitest";
import { activeSection, NAV_ITEMS } from "../lib/navigation";

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
    for (const [, icon, label] of NAV_ITEMS) {
      expect(icon).not.toBe("");
      expect(label).not.toBe("");
    }
  });
});
