import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchListing, fetchListings } from "../lib/supabase/queries";

type QueryResult = { data: unknown; error: Error | null };

function makeClient(result: QueryResult) {
  const calls: Array<[string, unknown[]]> = [];
  const builder = {
    select: (...args: unknown[]) => {
      calls.push(["select", args]);
      return builder;
    },
    eq: (...args: unknown[]) => {
      calls.push(["eq", args]);
      return builder;
    },
    order: (...args: unknown[]) => {
      calls.push(["order", args]);
      return builder;
    },
    limit: (...args: unknown[]) => {
      calls.push(["limit", args]);
      return builder;
    },
    ilike: (...args: unknown[]) => {
      calls.push(["ilike", args]);
      return builder;
    },
    lte: (...args: unknown[]) => {
      calls.push(["lte", args]);
      return builder;
    },
    lt: (...args: unknown[]) => {
      calls.push(["lt", args]);
      return builder;
    },
    maybeSingle: (...args: unknown[]) => {
      calls.push(["maybeSingle", args]);
      return builder;
    },
    then: (resolve: (value: QueryResult) => unknown) => Promise.resolve(resolve(result)),
  };
  return {
    client: { from: vi.fn(() => builder) },
    calls,
  };
}

vi.mock("../lib/supabase/browser", () => ({
  createSupabaseBrowserClient: vi.fn(),
}));

import { createSupabaseBrowserClient } from "../lib/supabase/browser";

const listing = {
  id: "listing-1",
  owner_id: "owner-1",
  location: "Ljubljana",
  price_per_month: 400,
  description: "",
  is_filled: false,
  version: 1,
  created_at: "2026-01-02T00:00:00Z",
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
};

describe("Supabase listing query boundary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("translates location, price, sort order, cursor, and limit filters", async () => {
    const mock = makeClient({ data: [listing], error: null });
    vi.mocked(createSupabaseBrowserClient).mockReturnValue(mock.client as never);

    await expect(fetchListings({
      location: " Ljubljana ",
      maxPrice: 500,
      cursor: "2026-01-03T00:00:00Z",
      limit: 12,
    })).resolves.toHaveLength(1);

    expect(mock.calls).toEqual([
      ["select", ["*"]],
      ["eq", ["is_filled", false]],
      ["order", ["created_at", { ascending: false }]],
      ["limit", [12]],
      ["ilike", ["location", "%Ljubljana%"]],
      ["lte", ["price_per_month", 500]],
      ["lt", ["created_at", "2026-01-03T00:00:00Z"]],
    ]);
  });

  it("returns an unknown id as null and preserves backend errors", async () => {
    const missing = makeClient({ data: null, error: null });
    vi.mocked(createSupabaseBrowserClient).mockReturnValue(missing.client as never);
    await expect(fetchListing("missing")).resolves.toBeNull();

    const backendError = new Error("offline");
    const failed = makeClient({ data: null, error: backendError });
    vi.mocked(createSupabaseBrowserClient).mockReturnValue(failed.client as never);
    await expect(fetchListings()).rejects.toBe(backendError);
  });

  it("does not convert malformed rows into successful listing results", async () => {
    const malformed = makeClient({ data: [{ ...listing, created_at: "" }], error: null });
    vi.mocked(createSupabaseBrowserClient).mockReturnValue(malformed.client as never);

    await expect(fetchListings()).rejects.toThrow("listings.created_at");
  });

  it("preserves detail-query backend errors", async () => {
    const backendError = new Error("permission denied");
    const failed = makeClient({ data: null, error: backendError });
    vi.mocked(createSupabaseBrowserClient).mockReturnValue(failed.client as never);

    await expect(fetchListing("listing-1")).rejects.toBe(backendError);
  });
});
