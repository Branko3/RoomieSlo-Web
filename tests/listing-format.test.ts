import { describe, expect, it } from "vitest";
import { createI18n } from "../lib/i18n/i18n";
import { catalogs } from "../lib/i18n/messages";
import {
  listingDetails,
  moveInLabel,
  roomTypeLabel,
  timestampDate,
} from "../lib/listings/format";
import { ROOM_TYPE_KEYS, ROOM_TYPES } from "../lib/listings/room-types";

const sl = createI18n("sl", catalogs.sl);
const en = createI18n("en", catalogs.en);

describe("moveInLabel", () => {
  it("writes ISO dates the Slovenian way without leading zeros", () => {
    expect(moveInLabel("2026-09-20", sl.m.listings, sl.formatters)).toBe(
      "20. 9. 2026",
    );
    expect(moveInLabel("2026-11-01", sl.m.listings, sl.formatters)).toBe(
      "1. 11. 2026",
    );
    expect(moveInLabel("2026-11-01", en.m.listings, en.formatters)).toBe(
      "01/11/2026",
    );
  });

  it("does not shift the day for timestamps", () => {
    expect(
      moveInLabel("2026-01-01T23:30:00Z", sl.m.listings, sl.formatters),
    ).toBe("1. 1. 2026");
  });

  it("says 'by arrangement' when there is no date", () => {
    expect(moveInLabel(null, sl.m.listings, sl.formatters)).toBe("po dogovoru");
    expect(moveInLabel(undefined, en.m.listings, en.formatters)).toBe(
      "by arrangement",
    );
  });
});

describe("timestampDate", () => {
  it("uses the calendar day in Ljubljana", () => {
    expect(timestampDate("2026-01-01T23:30:00Z", sl.formatters)).toBe(
      "2. 1. 2026",
    );
    expect(timestampDate("2026-07-15T21:59:00Z", sl.formatters)).toBe(
      "15. 7. 2026",
    );
    expect(timestampDate("2026-07-15T22:00:00Z", sl.formatters)).toBe(
      "16. 7. 2026",
    );
    expect(timestampDate("2026-07-15T22:00:00Z", en.formatters)).toBe(
      "16/07/2026",
    );
  });

  it("passes non-dates through", () => {
    expect(timestampDate("ni datum", sl.formatters)).toBe("ni datum");
  });
});

describe("euro amounts (formatters.currency)", () => {
  it("keep the euro sign on the same line", () => {
    expect(sl.formatters.currency(320)).toBe("320 €");
  });

  it("write cents and thousands the Slovenian way", () => {
    expect(sl.formatters.currency(320.5)).toBe("320,50 €");
    expect(sl.formatters.currency(1200)).toBe("1200 €");
    expect(sl.formatters.currency(12000)).toBe("12.000 €");
    expect(en.formatters.currency(12000)).toBe("€12,000");
  });
});

describe("roomTypeLabel", () => {
  it("labels every stored room type in both languages", () => {
    for (const type of ROOM_TYPES) {
      // Slovenian labels are the stored values themselves.
      expect(roomTypeLabel(type, sl.m.listings)).toBe(type);
      expect(roomTypeLabel(type, en.m.listings)).toBe(
        en.m.listings.roomTypes[ROOM_TYPE_KEYS[type]],
      );
    }
    expect(roomTypeLabel("garsonjera", en.m.listings)).toBe("studio");
  });

  it("reads an empty value as a room and shows unknown values as stored", () => {
    expect(roomTypeLabel("", sl.m.listings)).toBe("soba");
    expect(roomTypeLabel(undefined, en.m.listings)).toBe("room");
    expect(roomTypeLabel("vila", en.m.listings)).toBe("vila");
  });
});

describe("listingDetails", () => {
  it("joins the known facts", () => {
    const facts = { sizeSqm: 16, flatmates: 2, billsIncluded: true };
    expect(listingDetails(facts, sl)).toBe(
      "16 m² · 2 sostanovalca · stroški vključeni",
    );
    expect(listingDetails(facts, en)).toBe(
      "16 m² · 2 roommates · bills included",
    );
  });

  it("uses Slovenian plural forms for the roommates", () => {
    const flatmates = (count: number) =>
      listingDetails({ sizeSqm: null, flatmates: count }, sl);
    expect(flatmates(1)).toBe("1 sostanovalec");
    expect(flatmates(3)).toBe("3 sostanovalci");
    expect(flatmates(5)).toBe("5 sostanovalcev");
    expect(listingDetails({ flatmates: 1 }, en)).toBe("1 roommate");
  });

  it("leaves out unknown, zero and false facts (and old cached rows lack them)", () => {
    expect(
      listingDetails({ sizeSqm: null, flatmates: 0, billsIncluded: false }, sl),
    ).toBe("");
    expect(listingDetails({}, sl)).toBe("");
    expect(listingDetails({ sizeSqm: 0 }, sl)).toBe("0 m²");
  });
});

describe("search result count", () => {
  it.each([
    [0, "0 oglasov zate"],
    [1, "1 oglas zate"],
    [2, "2 oglasa zate"],
    [3, "3 oglasi zate"],
    [4, "4 oglasi zate"],
    [5, "5 oglasov zate"],
    [11, "11 oglasov zate"],
    [21, "21 oglasov zate"],
    [101, "101 oglas zate"],
    [102, "102 oglasa zate"],
    [103, "103 oglasi zate"],
    [111, "111 oglasov zate"],
    [205, "205 oglasov zate"],
  ])("%i → %s", (count, label) => {
    expect(sl.plural(sl.m.search.results, count)).toBe(label);
  });

  it("uses one and other in English", () => {
    expect(en.plural(en.m.search.results, 1)).toBe("1 listing for you");
    expect(en.plural(en.m.search.results, 2)).toBe("2 listings for you");
  });
});
