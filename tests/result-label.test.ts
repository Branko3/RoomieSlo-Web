import { describe, expect, it } from "vitest";
import { listingCountLabel } from "../lib/listings/result-label";

describe("listingCountLabel (Slovenian singular, dual, plural)", () => {
  it.each([
    [0, "oglasov"],
    [1, "oglas"],
    [2, "oglasa"],
    [3, "oglasi"],
    [4, "oglasi"],
    [5, "oglasov"],
    [11, "oglasov"],
    [12, "oglasov"],
    [21, "oglasov"],
    [101, "oglas"],
    [102, "oglasa"],
    [103, "oglasi"],
    [104, "oglasi"],
    [111, "oglasov"],
    [205, "oglasov"],
  ])("%i → %s", (count, label) => {
    expect(listingCountLabel(count)).toBe(label);
  });
});
