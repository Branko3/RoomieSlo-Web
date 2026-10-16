import { describe, expect, it } from "vitest";
import {
  addMonths,
  currentMonth,
  dateLabel,
  endedMonthOptions,
  endedMonthProblem,
  isMonth,
  monthLabel,
  monthOf,
  monthsBetween,
  monthSpanLabel,
  startedMonthOptions,
  startedMonthProblem,
} from "../lib/cohabitation/months";

const NOW = new Date("2026-10-16T10:00:00Z");

describe("months", () => {
  it("recognises first-of-month ISO dates only", () => {
    expect(isMonth("2026-10-01")).toBe(true);
    expect(isMonth("2026-10-02")).toBe(false);
    expect(isMonth("2026-13-01")).toBe(false);
    expect(isMonth("2026-10")).toBe(false);
    expect(isMonth(null)).toBe(false);
  });

  it("reads the month in Slovenian time, like the database", () => {
    // 23:30 UTC on 31 Oct is already 1 Nov in Ljubljana (CET, UTC+1).
    expect(monthOf("2026-10-31T23:30:00Z")).toBe("2026-11-01");
    // 22:30 UTC on 31 Mar is already 1 Apr in Ljubljana (CEST, UTC+2).
    expect(monthOf(new Date("2026-03-31T22:30:00Z"))).toBe("2026-04-01");
    expect(monthOf("not a date")).toBeNull();
    expect(currentMonth(NOW)).toBe("2026-10-01");
    expect(currentMonth()).toMatch(/^\d{4}-\d{2}-01$/);
  });

  it("moves across year boundaries", () => {
    expect(addMonths("2026-10-01", 3)).toBe("2027-01-01");
    expect(addMonths("2026-01-01", -1)).toBe("2025-12-01");
    expect(addMonths("2026-10-01", 0)).toBe("2026-10-01");
  });

  it("lists months newest first", () => {
    expect(monthsBetween("2026-11-01", "2027-01-01")).toEqual([
      "2027-01-01",
      "2026-12-01",
      "2026-11-01",
    ]);
    expect(monthsBetween("2026-10-01", "2026-10-01")).toEqual(["2026-10-01"]);
    expect(monthsBetween("2026-11-01", "2026-10-01")).toEqual([]);
  });

  it("labels months the Slovenian way", () => {
    expect(monthLabel("2026-10-01")).toBe("okt. 2026");
    expect(monthLabel("2027-05-01")).toBe("maj 2027");
    expect(monthLabel("2027-01-01")).toBe("jan. 2027");
    expect(monthLabel("oops")).toBe("oops");
    expect(monthSpanLabel("2026-10-01", null)).toBe("od okt. 2026");
    expect(monthSpanLabel("2026-10-01", "2027-01-01")).toBe(
      "okt. 2026 – jan. 2027",
    );
    expect(dateLabel(new Date("2026-11-15T12:00:00Z"))).toBe("15. 11. 2026");
  });
});

describe("move-in month rules", () => {
  const matchCreatedAt = "2026-08-20T09:00:00Z";

  it("accepts the match month up to the current month", () => {
    expect(startedMonthProblem("2026-08-01", matchCreatedAt, NOW)).toBeNull();
    expect(startedMonthProblem("2026-10-01", matchCreatedAt, NOW)).toBeNull();
  });

  it("refuses a future month, a month before the match, and non-months", () => {
    expect(startedMonthProblem("2026-11-01", matchCreatedAt, NOW)).toBe(
      "future",
    );
    expect(startedMonthProblem("2026-07-01", matchCreatedAt, NOW)).toBe(
      "before-match",
    );
    expect(startedMonthProblem("2026-10-15", matchCreatedAt, NOW)).toBe(
      "not-a-month",
    );
    // Without the match date only the future rule applies here (the server checks the rest).
    expect(startedMonthProblem("2020-01-01", null, NOW)).toBeNull();
    expect(startedMonthProblem("2999-01-01", null)).toBe("future");
  });

  it("offers exactly the allowed months", () => {
    expect(startedMonthOptions(matchCreatedAt, NOW)).toEqual([
      "2026-10-01",
      "2026-09-01",
      "2026-08-01",
    ]);
    expect(startedMonthOptions(null, NOW)).toHaveLength(12);
    expect(startedMonthOptions(null)[0]).toBe(currentMonth());
  });
});

describe("end month rules", () => {
  it("accepts the move-in month up to the current month", () => {
    expect(endedMonthProblem("2026-09-01", "2026-09-01", NOW)).toBeNull();
    expect(endedMonthProblem("2026-10-01", "2026-09-01", NOW)).toBeNull();
    expect(endedMonthProblem("2026-10-01", "2026-09-01")).toBeNull();
  });

  it("refuses an end before the move-in month, in the future, or not a month", () => {
    expect(endedMonthProblem("2026-08-01", "2026-09-01", NOW)).toBe(
      "before-start",
    );
    expect(endedMonthProblem("2026-11-01", "2026-09-01", NOW)).toBe("future");
    expect(endedMonthProblem("", "2026-09-01", NOW)).toBe("not-a-month");
  });

  it("offers the move-in month through the current month", () => {
    expect(endedMonthOptions("2026-09-01", NOW)).toEqual([
      "2026-10-01",
      "2026-09-01",
    ]);
    expect(endedMonthOptions(currentMonth())).toEqual([currentMonth()]);
  });
});
