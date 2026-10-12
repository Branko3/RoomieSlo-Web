import { describe, expect, it } from "vitest";
import {
  clampPageSize,
  cursorFilter,
  DEFAULT_PAGE_SIZE,
  fetchListingsPage,
  flattenPages,
  MAX_PAGE_SIZE,
  quoteFilterValue,
  type ListingCursor,
  type ListingPage,
  type ListingPageBuilder,
  type ListingPageClient,
} from "../lib/listings/pagination";
import type { Row } from "../lib/supabase/types";

type ListingRow = Row<"listings">;

function row(
  id: string,
  createdAt: string,
  overrides: Partial<ListingRow> = {},
): ListingRow {
  return {
    id,
    owner_id: "owner-1",
    location: "Ljubljana",
    price_per_month: 400,
    description: "",
    is_filled: false,
    version: 1,
    created_at: createdAt,
    title: `Soba ${id}`,
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
  };
}

const unquote = (value: string) =>
  value.replace(/^"|"$/g, "").replace(/\\"/g, '"').replace(/\\\\/g, "\\");

/**
 * In-memory stand-in for the PostgREST builder. It records calls and applies
 * the same filters to a table, including the keyset `or(...)` produced by
 * `cursorFilter`, so pagination can be verified end to end.
 */
function fakeClient(table: ListingRow[], fail?: unknown) {
  const calls: Array<[string, unknown[]]> = [];
  let rows = [...table];
  const orders: Array<[keyof ListingRow, boolean]> = [];
  let limit = Infinity;
  const builder: ListingPageBuilder = {
    select(columns) {
      calls.push(["select", [columns]]);
      return builder;
    },
    eq(column, value) {
      calls.push(["eq", [column, value]]);
      rows = rows.filter((r) => r[column as keyof ListingRow] === value);
      return builder;
    },
    order(column, options) {
      calls.push(["order", [column, options]]);
      orders.push([column as keyof ListingRow, options.ascending]);
      return builder;
    },
    limit(count) {
      calls.push(["limit", [count]]);
      limit = count;
      return builder;
    },
    ilike(column, pattern) {
      calls.push(["ilike", [column, pattern]]);
      const needle = pattern.replace(/%/g, "").toLowerCase();
      rows = rows.filter((r) =>
        String(r[column as keyof ListingRow])
          .toLowerCase()
          .includes(needle),
      );
      return builder;
    },
    lte(column, value) {
      calls.push(["lte", [column, value]]);
      rows = rows.filter((r) => Number(r[column as keyof ListingRow]) <= value);
      return builder;
    },
    or(filters) {
      calls.push(["or", [filters]]);
      const match = filters.match(
        /^created_at\.lt\.("(?:[^"\\]|\\.)*"),and\(created_at\.eq\.("(?:[^"\\]|\\.)*"),id\.lt\.("(?:[^"\\]|\\.)*")\)$/,
      );
      if (!match) throw new Error(`Unexpected or filter: ${filters}`);
      const createdAt = unquote(match[1]);
      const id = unquote(match[3]);
      rows = rows.filter(
        (r) =>
          r.created_at < createdAt || (r.created_at === createdAt && r.id < id),
      );
      return builder;
    },
    then(onFulfilled, onRejected) {
      if (fail)
        return Promise.resolve({ data: null, error: fail }).then(
          onFulfilled,
          onRejected,
        );
      const sorted = [...rows].sort((a, b) => {
        for (const [column, ascending] of orders) {
          const left = String(a[column]);
          const right = String(b[column]);
          if (left !== right)
            return (left < right ? -1 : 1) * (ascending ? 1 : -1);
        }
        return 0;
      });
      return Promise.resolve({
        data: sorted.slice(0, limit),
        error: null,
      }).then(onFulfilled, onRejected);
    },
  };
  const client: ListingPageClient = { from: () => builder };
  return { client, calls };
}

async function collectAll(table: ListingRow[], pageSize: number) {
  const pages: ListingPage[] = [];
  let cursor: ListingCursor | null = null;
  for (let guard = 0; guard < 100; guard += 1) {
    const page = await fetchListingsPage(fakeClient(table).client, {
      cursor,
      pageSize,
    });
    pages.push(page);
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }
  return pages;
}

describe("fetchListingsPage query", () => {
  it("orders by created_at then id, requests one extra row, and applies filters", async () => {
    const { client, calls } = fakeClient([]);
    await fetchListingsPage(client, {
      location: " Ljubljana ",
      maxPrice: 500,
      cursor: { createdAt: "2026-01-03T10:00:00.123+00:00", id: "b" },
      pageSize: 12,
    });
    expect(calls).toEqual([
      ["select", ["*"]],
      ["eq", ["is_filled", false]],
      ["order", ["created_at", { ascending: false }]],
      ["order", ["id", { ascending: false }]],
      ["limit", [13]],
      ["ilike", ["location", "%Ljubljana%"]],
      ["lte", ["price_per_month", 500]],
      [
        "or",
        [
          'created_at.lt."2026-01-03T10:00:00.123+00:00",and(created_at.eq."2026-01-03T10:00:00.123+00:00",id.lt."b")',
        ],
      ],
    ]);
  });

  it("omits optional filters and the cursor on the first page", async () => {
    const { client, calls } = fakeClient([]);
    await fetchListingsPage(client);
    expect(calls.map(([name]) => name)).toEqual([
      "select",
      "eq",
      "order",
      "order",
      "limit",
    ]);
    expect(calls[4]).toEqual(["limit", [DEFAULT_PAGE_SIZE + 1]]);
  });

  it("preserves backend errors", async () => {
    const backendError = new Error("permission denied");
    await expect(
      fetchListingsPage(fakeClient([], backendError).client),
    ).rejects.toBe(backendError);
  });

  it("rejects malformed rows instead of returning a broken page", async () => {
    await expect(
      fetchListingsPage(fakeClient([row("a", "")]).client),
    ).rejects.toThrow("listings.created_at");
  });
});

describe("keyset pagination", () => {
  const table = [
    row("a", "2026-01-01T00:00:00Z"),
    row("b", "2026-01-02T00:00:00Z"),
    row("c", "2026-01-02T00:00:00Z"),
    row("d", "2026-01-02T00:00:00Z"),
    row("e", "2026-01-03T00:00:00Z"),
    row("f", "2026-01-04T00:00:00Z"),
    row("g", "2026-01-04T00:00:00Z", { is_filled: true }),
  ];

  it("returns every available listing exactly once, newest first, across pages with ties", async () => {
    const pages = await collectAll(table, 2);
    expect(pages.map((page) => page.items.map((l) => l.id))).toEqual([
      ["f", "e"],
      ["d", "c"],
      ["b", "a"],
    ]);
    expect(flattenPages(pages).map((l) => l.id)).toEqual([
      "f",
      "e",
      "d",
      "c",
      "b",
      "a",
    ]);
  });

  it("works for every page size without skipping or repeating", async () => {
    for (let size = 1; size <= 7; size += 1) {
      const ids = flattenPages(await collectAll(table, size)).map((l) => l.id);
      expect(ids).toEqual(["f", "e", "d", "c", "b", "a"]);
    }
  });

  it("ends without an extra empty request when the last page is exactly full", async () => {
    const pages = await collectAll(table, 3);
    expect(pages).toHaveLength(2);
    expect(pages[1].nextCursor).toBeNull();
  });

  it("returns the cursor of the last item when more rows exist", async () => {
    const page = await fetchListingsPage(fakeClient(table).client, {
      pageSize: 2,
    });
    expect(page.nextCursor).toEqual({
      createdAt: "2026-01-03T00:00:00Z",
      id: "e",
    });
  });

  it("returns an empty final page for an empty feed", async () => {
    await expect(fetchListingsPage(fakeClient([]).client)).resolves.toEqual({
      items: [],
      nextCursor: null,
    });
  });

  it("keeps filters applied on later pages", async () => {
    const mixed = [
      row("a", "2026-01-01T00:00:00Z", { price_per_month: 300 }),
      row("b", "2026-01-02T00:00:00Z", { price_per_month: 900 }),
      row("c", "2026-01-03T00:00:00Z", {
        price_per_month: 350,
        location: "Maribor",
      }),
      row("d", "2026-01-04T00:00:00Z", { price_per_month: 380 }),
    ];
    const first = await fetchListingsPage(fakeClient(mixed).client, {
      location: "ljubljana",
      maxPrice: 400,
      pageSize: 1,
    });
    const second = await fetchListingsPage(fakeClient(mixed).client, {
      location: "ljubljana",
      maxPrice: 400,
      pageSize: 1,
      cursor: first.nextCursor,
    });
    expect([...first.items, ...second.items].map((l) => l.id)).toEqual([
      "d",
      "a",
    ]);
    expect(second.nextCursor).toBeNull();
  });
});

describe("helpers", () => {
  it("clamps page sizes", () => {
    expect(clampPageSize(undefined)).toBe(DEFAULT_PAGE_SIZE);
    expect(clampPageSize(Number.NaN)).toBe(DEFAULT_PAGE_SIZE);
    expect(clampPageSize(0)).toBe(1);
    expect(clampPageSize(7.9)).toBe(7);
    expect(clampPageSize(1000)).toBe(MAX_PAGE_SIZE);
  });

  it("quotes PostgREST filter values and escapes quotes and backslashes", () => {
    expect(quoteFilterValue("2026-01-01T00:00:00.5+00:00")).toBe(
      '"2026-01-01T00:00:00.5+00:00"',
    );
    expect(quoteFilterValue('a"b\\c')).toBe('"a\\"b\\\\c"');
  });

  it("builds the keyset condition with an id tie-breaker", () => {
    expect(cursorFilter({ createdAt: "2026-01-01", id: "x" })).toBe(
      'created_at.lt."2026-01-01",and(created_at.eq."2026-01-01",id.lt."x")',
    );
  });

  it("drops duplicates when flattening pages", () => {
    const pages: ListingPage[] = [
      { items: [{ id: "a" }, { id: "b" }] as never, nextCursor: null },
      { items: [{ id: "b" }, { id: "c" }] as never, nextCursor: null },
    ];
    expect(flattenPages(pages).map((l) => l.id)).toEqual(["a", "b", "c"]);
  });
});
