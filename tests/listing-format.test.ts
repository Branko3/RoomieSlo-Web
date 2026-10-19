import { describe, expect, it } from "vitest";
import {
  formatMoveIn,
  formatPrice,
  formatTimestampDate,
} from "../lib/listings/format";

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

describe("formatTimestampDate", () => {
  it("uses the calendar day in Ljubljana", () => {
    expect(formatTimestampDate("2026-01-01T23:30:00Z")).toBe("2. 1. 2026");
    expect(formatTimestampDate("2026-07-15T21:59:00Z")).toBe("15. 7. 2026");
    expect(formatTimestampDate("2026-07-15T22:00:00Z")).toBe("16. 7. 2026");
  });

  it("passes non-dates through", () => {
    expect(formatTimestampDate("ni datum")).toBe("ni datum");
  });
});

describe("formatPrice", () => {
  it("keeps the euro sign on the same line", () => {
    expect(formatPrice(320)).toBe("320 €");
  });

  it("writes cents and thousands the Slovenian way", () => {
    expect(formatPrice(320.5)).toBe("320,50 €");
    expect(formatPrice(1200)).toBe("1200 €");
    expect(formatPrice(12000)).toBe("12.000 €");
  });
});
