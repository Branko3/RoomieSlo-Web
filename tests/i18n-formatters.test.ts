import { describe, expect, it } from "vitest";
import { getFormatters } from "../lib/i18n/formatters";
import { dayLabel, messageTime } from "../lib/chat/messages";
import {
  formatMoveIn,
  formatPrice,
  formatTimestampDate,
} from "../lib/listings/format";

// 22:30 UTC on 20 September is already 21 September in Ljubljana (UTC+2).
const LATE_EVENING_UTC = "2026-09-20T22:30:00Z";
const NBSP = " ";

describe("getFormatters", () => {
  it("creates the formatters once per locale", () => {
    expect(getFormatters("sl")).toBe(getFormatters("sl"));
    expect(getFormatters("en")).not.toBe(getFormatters("sl"));
    expect(getFormatters("en").intlLocale).toBe("en-GB");
    expect(getFormatters("sl").timeZone).toBe("Europe/Ljubljana");
  });

  it("formats dates and times in Ljubljana time", () => {
    const sl = getFormatters("sl");
    const en = getFormatters("en");
    expect(sl.date(LATE_EVENING_UTC)).toBe("21. 9. 2026");
    expect(en.date(LATE_EVENING_UTC)).toBe("21/09/2026");
    expect(sl.time(LATE_EVENING_UTC)).toBe("00:30");
    expect(en.time(new Date(LATE_EVENING_UTC))).toBe("00:30");
    expect(sl.dateTime(LATE_EVENING_UTC)).toBe("21. 9. 2026, 00:30");
    expect(en.dateTime(Date.parse(LATE_EVENING_UTC))).toBe("21/09/2026, 00:30");
    expect(sl.dayLabel(LATE_EVENING_UTC)).toBe("ponedeljek, 21. september");
    expect(en.dayLabel(LATE_EVENING_UTC)).toBe("Monday 21 September");
    expect(en.dateTimeMedium(LATE_EVENING_UTC)).toMatch(
      /^21 Sept? 2026, 00:30$/,
    );
    expect(en.dateTimeShort(LATE_EVENING_UTC)).toBe("21/09/2026, 00:30");
    expect(sl.dateTimeMedium(LATE_EVENING_UTC)).toContain("2026");
    expect(sl.dateTimeShort(LATE_EVENING_UTC)).toContain("00:30");
  });

  it("formats a calendar day without shifting it", () => {
    expect(getFormatters("sl").calendarDate("2026-09-20")).toBe("20. 9. 2026");
    expect(getFormatters("en").calendarDate("2026-01-05")).toBe("05/01/2026");
    expect(getFormatters("en").calendarDate("po dogovoru")).toBe("po dogovoru");
  });

  it("formats euros: whole amounts without decimals", () => {
    const sl = getFormatters("sl");
    const en = getFormatters("en");
    expect(sl.currency(320)).toBe(`320${NBSP}€`);
    expect(sl.currency(320.5)).toBe(`320,50${NBSP}€`);
    expect(sl.currency(12000)).toBe(`12.000${NBSP}€`);
    expect(en.currency(1250)).toBe("€1,250");
    expect(en.currency(320.5)).toBe("€320.50");
    expect(en.number(12345.5)).toBe("12,345.5");
    expect(sl.number(12345.5)).toBe("12.345,5");
  });

  it("gives the same Slovenian output as the formatters it replaces", () => {
    const sl = getFormatters("sl");
    for (const amount of [0, 5, 320, 320.5, 1200, 12000, 99999.99]) {
      expect(sl.currency(amount)).toBe(formatPrice(amount));
    }
    expect(sl.calendarDate("2026-09-20")).toBe(formatMoveIn("2026-09-20"));
    expect(sl.date(LATE_EVENING_UTC)).toBe(
      formatTimestampDate(LATE_EVENING_UTC),
    );
    expect(sl.time(LATE_EVENING_UTC)).toBe(messageTime(LATE_EVENING_UTC));
    const now = new Date("2026-10-30T12:00:00Z");
    expect(sl.dayLabel(LATE_EVENING_UTC)).toBe(dayLabel("2026-09-21", now));
  });
});
