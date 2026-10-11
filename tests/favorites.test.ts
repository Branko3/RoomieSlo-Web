import { describe, expect, it } from "vitest";
import {
  FAVORITES_KEY,
  parseFavorites,
  serializeFavorites,
  toggleFavoriteId,
} from "../lib/favorites";

describe("favorites storage", () => {
  it("keeps the existing storage key so saved favorites survive", () => {
    expect(FAVORITES_KEY).toBe("roomieslo:favorites");
  });

  it("reads nothing saved as an empty list", () => {
    expect(parseFavorites(null)).toEqual([]);
  });

  it("round-trips saved ids", () => {
    const ids = ["l1", "l2"];
    expect(parseFavorites(serializeFavorites(ids))).toEqual(ids);
  });

  it("drops duplicates, empty ids, and non-string entries", () => {
    expect(parseFavorites('["l1", "", 3, null, "l1", "l2"]')).toEqual([
      "l1",
      "l2",
    ]);
  });

  it("rejects corrupt or wrongly shaped data so it can be discarded", () => {
    expect(parseFavorites("{not json")).toBeNull();
    expect(parseFavorites('{"l1": true}')).toBeNull();
    expect(parseFavorites('"l1"')).toBeNull();
  });
});

describe("toggleFavoriteId", () => {
  it("adds a new listing at the end without mutating the input", () => {
    const current = ["l1"];
    expect(toggleFavoriteId(current, "l2")).toEqual(["l1", "l2"]);
    expect(current).toEqual(["l1"]);
  });

  it("removes a saved listing", () => {
    expect(toggleFavoriteId(["l1", "l2"], "l1")).toEqual(["l2"]);
  });

  it("is its own inverse", () => {
    const start = ["l1", "l2"];
    expect(toggleFavoriteId(toggleFavoriteId(start, "l3"), "l3")).toEqual(
      start,
    );
  });
});
