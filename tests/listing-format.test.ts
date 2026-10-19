import { describe, expect, it } from "vitest";
import { formatMoveIn, formatPrice } from "../lib/listings/format";

describe("formatMoveIn", () => {
  it("writes ISO dates the Slovenian way without leading zeros", () => {
    expect(formatMoveIn("2026-09-20")).toBe("20. 9. 2026");
    expect(formatMoveIn("2026-11-01")).toBe("1. 11. 2026");
  });

  it("does not shift the day for timestamps", () => {
    expect(formatMoveIn("2026-01-01T23:30:00Z")).toBe("1. 1. 2026");
  });

  it("passes non-dates through", () => {
    expect(formatMoveIn("po dogovoru")).toBe("po dogovoru");
  });
});

describe("formatPrice", () => {
  it("keeps the euro sign on the same line", () => {
    expect(formatPrice(320)).toBe("320 €");
  });
});
