import { describe, expect, it } from "vitest";
import { format, plural } from "../lib/i18n/format";
import { createI18n } from "../lib/i18n/i18n";
import { catalogs } from "../lib/i18n/messages";
import { pluralForms } from "../lib/i18n/messages/plural";

describe("format", () => {
  it("fills named placeholders, also repeated ones", () => {
    expect(format("Živjo, {name}!", { name: "Ana" })).toBe("Živjo, Ana!");
    expect(format("{a} in {a}, {b}", { a: 1, b: "x" })).toBe("1 in 1, x");
  });

  it("leaves a placeholder without a value visible", () => {
    expect(format("{name} ({age})", { name: "Ana" })).toBe("Ana ({age})");
    expect(format("{name}")).toBe("{name}");
    expect(format("{toString}", {})).toBe("{toString}");
  });

  it("keeps falsy values", () => {
    expect(format("{count} / {label}", { count: 0, label: "" })).toBe("0 / ");
  });
});

const oglasi = pluralForms({
  one: "{count} oglas",
  two: "{count} oglasa",
  few: "{count} oglasi",
  other: "{count} oglasov",
});

describe("plural", () => {
  it("uses the four Slovenian forms by the last two digits", () => {
    const cases: [number, string][] = [
      [0, "0 oglasov"],
      [1, "1 oglas"],
      [2, "2 oglasa"],
      [3, "3 oglasi"],
      [4, "4 oglasi"],
      [5, "5 oglasov"],
      [11, "11 oglasov"],
      [101, "101 oglas"],
      [102, "102 oglasa"],
      [103, "103 oglasi"],
      [105, "105 oglasov"],
    ];
    for (const [count, expected] of cases) {
      expect(plural("sl", oglasi, count)).toBe(expected);
    }
  });

  it("uses one and other in English, falling back to other", () => {
    const listings = { one: "{count} listing", other: "{count} listings" };
    expect(plural("en", listings, 1)).toBe("1 listing");
    expect(plural("en", listings, 2)).toBe("2 listings");
    expect(plural("en", listings, 0)).toBe("0 listings");
    // A Slovenian `two`/`few` form is never picked for English.
    expect(plural("en", oglasi, 2)).toBe("2 oglasov");
  });

  it("falls back to other when a Slovenian form is missing", () => {
    expect(plural("sl", { one: "{count} x", other: "{count} y" }, 2)).toBe(
      "2 y",
    );
  });

  it("fills other placeholders and lets vars override the count", () => {
    const forms = { one: "{name}: {count} item", other: "{name}: {count}" };
    expect(plural("en", forms, 1, { name: "Ana" })).toBe("Ana: 1 item");
    expect(plural("en", forms, 1200, { name: "Ana", count: "1,200" })).toBe(
      "Ana: 1,200",
    );
  });
});

describe("createI18n", () => {
  it("binds the locale to plural and formatters", () => {
    const i18n = createI18n("en", catalogs.en);
    expect(i18n.locale).toBe("en");
    expect(i18n.m).toBe(catalogs.en);
    expect(
      i18n.plural({ one: "{count} chat", other: "{count} chats" }, 3),
    ).toBe("3 chats");
    expect(i18n.format("{a}", { a: "b" })).toBe("b");
    expect(i18n.formatters.intlLocale).toBe("en-GB");
  });
});
