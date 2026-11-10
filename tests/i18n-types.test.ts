import { describe, expect, it } from "vitest";
import { pluralForms } from "../lib/i18n/messages/plural";
import type { CatalogShape, Messages } from "../lib/i18n/types";

// Type-level checks: `npm run typecheck` fails if any `@ts-expect-error` below
// stops being an error, i.e. if the catalog typing loosens.

const slNamespace = {
  mine: {
    title: "Moji oglasi",
    count: pluralForms({
      one: "{count} oglas",
      two: "{count} oglasa",
      few: "{count} oglasi",
      other: "{count} oglasov",
    }),
  },
};
type Namespace = CatalogShape<typeof slNamespace>;

const english: Namespace = {
  mine: {
    title: "My listings",
    count: { one: "{count} listing", other: "{count} listings" },
  },
};

// @ts-expect-error a missing key
const missing: Namespace = { mine: { count: { one: "", other: "" } } };

const extra: Namespace = {
  // @ts-expect-error an extra key
  mine: { title: "", count: { one: "", other: "" }, subtitle: "" },
};

// @ts-expect-error a plural without `other`
const noOther: Namespace = { mine: { title: "", count: { one: "" } } };

const notText: Namespace = {
  // @ts-expect-error a non-string value
  mine: { title: 1, count: { one: "", other: "" } },
};

// @ts-expect-error Slovenian plurals need all four forms
pluralForms({ one: "{count} oglas", other: "{count} oglasov" });

function unknownKey(m: Messages) {
  // @ts-expect-error keys are checked on access
  return m.common.doesNotExist;
}

describe("catalog typing", () => {
  it("compiles the valid shapes", () => {
    expect(english.mine.count.other).toBe("{count} listings");
    expect([missing, extra, noOther, notText, unknownKey]).toHaveLength(5);
  });
});
