import { describe, expect, it } from "vitest";
import {
  activeListingsLabel,
  fetchMyListings,
  filledListingsLabel,
  groupMyListings,
  MY_LISTINGS_LIMIT,
  myListingsSummary,
  type MyListingsBuilder,
  type MyListingsClient,
} from "../lib/listings/my-listings";
import type { Listing } from "../lib/supabase/mappers";
import type { Row } from "../lib/supabase/types";

function row(id: string, overrides: Partial<Row<"listings">> = {}) {
  return {
    id,
    owner_id: "me",
    location: "Ljubljana",
    price_per_month: 300,
    description: "",
    is_filled: false,
    version: 1,
    created_at: "2026-10-01T00:00:00Z",
    title: "Soba",
    room_type: "soba",
    district: "Center",
    available_from: null,
    size_sqm: null,
    deposit: null,
    bills_included: false,
    furnished: false,
    flatmates_count: 0,
    photo_url: "",
    ...overrides,
  } satisfies Row<"listings">;
}

function fakeClient(result: {
  data: Row<"listings">[] | null;
  error: unknown;
}) {
  const calls: Array<[string, unknown[]]> = [];
  const tables: string[] = [];
  const builder: MyListingsBuilder = {
    select(columns) {
      calls.push(["select", [columns]]);
      return builder;
    },
    eq(column, value) {
      calls.push(["eq", [column, value]]);
      return builder;
    },
    order(column, options) {
      calls.push(["order", [column, options]]);
      return builder;
    },
    limit(count) {
      calls.push(["limit", [count]]);
      return builder;
    },
    then(onFulfilled, onRejected) {
      return Promise.resolve(result).then(onFulfilled, onRejected);
    },
  };
  const client: MyListingsClient = {
    from: (table) => {
      tables.push(table);
      return builder;
    },
  };
  return { client, calls, tables };
}

const listing = (id: string, isFilled: boolean) =>
  ({ id, isFilled }) as unknown as Listing;

describe("fetchMyListings", () => {
  // Unlike the browsing feeds there is no is_filled filter: filled listings stay.
  it("loads only the owner's listings, filled ones included, available first then newest", async () => {
    const { client, calls, tables } = fakeClient({
      data: [row("a"), row("b", { is_filled: true })],
      error: null,
    });
    const listings = await fetchMyListings(client, "me");
    expect(tables).toEqual(["listings"]);
    expect(calls).toEqual([
      ["select", ["*"]],
      ["eq", ["owner_id", "me"]],
      ["order", ["is_filled", { ascending: true }]],
      ["order", ["created_at", { ascending: false }]],
      ["order", ["id", { ascending: false }]],
      ["limit", [MY_LISTINGS_LIMIT]],
    ]);
    expect(listings.map((l) => [l.id, l.isFilled])).toEqual([
      ["a", false],
      ["b", true],
    ]);
  });

  it("refuses to run without an owner id", async () => {
    await expect(
      fetchMyListings(fakeClient({ data: [], error: null }).client, ""),
    ).rejects.toThrow("Owner id is required");
  });

  it("preserves backend errors and treats no rows as an empty list", async () => {
    const backendError = new Error("permission denied");
    await expect(
      fetchMyListings(
        fakeClient({ data: null, error: backendError }).client,
        "me",
      ),
    ).rejects.toBe(backendError);
    await expect(
      fetchMyListings(fakeClient({ data: null, error: null }).client, "me"),
    ).resolves.toEqual([]);
  });
});

describe("grouping and Slovenian counts", () => {
  it("splits available and filled listings, keeping their order", () => {
    const groups = groupMyListings([
      listing("a", false),
      listing("b", true),
      listing("c", false),
    ]);
    expect(groups.available.map((l) => l.id)).toEqual(["a", "c"]);
    expect(groups.filled.map((l) => l.id)).toEqual(["b"]);
  });

  it.each([
    [0, "0 aktivnih oglasov"],
    [1, "1 aktiven oglas"],
    [2, "2 aktivna oglasa"],
    [3, "3 aktivni oglasi"],
    [4, "4 aktivni oglasi"],
    [5, "5 aktivnih oglasov"],
    [101, "101 aktiven oglas"],
    [111, "111 aktivnih oglasov"],
  ])("%i → %s", (count, label) => {
    expect(activeListingsLabel(count)).toBe(label);
  });

  it.each([
    [1, "1 zapolnjen"],
    [2, "2 zapolnjena"],
    [3, "3 zapolnjeni"],
    [5, "5 zapolnjenih"],
  ])("%i → %s", (count, label) => {
    expect(filledListingsLabel(count)).toBe(label);
  });

  it("mentions filled listings only when there are some", () => {
    expect(myListingsSummary([listing("a", false)])).toBe("1 aktiven oglas");
    expect(
      myListingsSummary([
        listing("a", false),
        listing("b", false),
        listing("c", true),
      ]),
    ).toBe("2 aktivna oglasa, 1 zapolnjen");
  });
});
