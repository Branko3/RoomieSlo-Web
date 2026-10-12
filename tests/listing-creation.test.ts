import { describe, expect, it, vi } from "vitest";
import {
  createListing,
  digitsOnly,
  DISTRICTS,
  emptyListingDraft,
  isValidIsoDate,
  listingSaveErrorMessages,
  ListingSaveError,
  ROOM_TYPES,
  validateListingDraft,
  type ListingCreateClient,
  type ListingDraft,
  type ListingValues,
} from "../lib/listings/listing-form";

const draft = (overrides: Partial<ListingDraft> = {}): ListingDraft => ({
  ...emptyListingDraft,
  location: "Ljubljana",
  price: "350",
  ...overrides,
});

function errorsFor(input: ListingDraft) {
  const result = validateListingDraft(input);
  return result.ok ? {} : result.errors;
}

describe("Android option lists", () => {
  it("offers the same room types and districts as Android", () => {
    expect(ROOM_TYPES).toEqual([
      "soba",
      "garsonjera",
      "deljeno stanovanje",
      "celo stanovanje",
    ]);
    expect(DISTRICTS).toEqual([
      "Bežigrad",
      "Center",
      "Šiška",
      "Vič",
      "Moste",
      "Rudnik",
      "Trnovo",
      "Rožna dolina",
      "Črnuče",
    ]);
  });
});

describe("validateListingDraft", () => {
  it("requires location and price like Android", () => {
    expect(errorsFor({ ...emptyListingDraft })).toEqual({
      location: "Vnesi lokacijo.",
      price: "Vnesi ceno.",
    });
    expect(errorsFor(draft({ location: "   " }))).toHaveProperty("location");
  });

  it("converts a minimal draft with Android defaults", () => {
    expect(validateListingDraft(draft())).toEqual({
      ok: true,
      values: {
        location: "Ljubljana",
        price_per_month: 350,
        description: "",
        title: "",
        room_type: "",
        district: "",
        available_from: null,
        size_sqm: null,
        deposit: null,
        bills_included: false,
        furnished: false,
        flatmates_count: 0,
      },
    });
  });

  it("trims text and converts every optional field", () => {
    const result = validateListingDraft(
      draft({
        location: "  Ljubljana ",
        title: " Svetla soba ",
        description: " Blizu FRI. \n",
        roomType: "soba",
        district: "Vič",
        availableFrom: " 2026-09-01 ",
        sizeSqm: "14",
        deposit: "400",
        flatmates: "2",
        billsIncluded: true,
        furnished: true,
      }),
    );
    expect(result).toEqual({
      ok: true,
      values: {
        location: "Ljubljana",
        price_per_month: 350,
        description: "Blizu FRI.",
        title: "Svetla soba",
        room_type: "soba",
        district: "Vič",
        available_from: "2026-09-01",
        size_sqm: 14,
        deposit: 400,
        bills_included: true,
        furnished: true,
        flatmates_count: 2,
      },
    });
  });

  it("accepts a price of zero like Android", () => {
    expect(validateListingDraft(draft({ price: "0" })).ok).toBe(true);
  });

  it.each([
    ["price", { price: "12.5" }],
    ["price", { price: "-5" }],
    ["price", { price: "100001" }],
    ["sizeSqm", { sizeSqm: "1001" }],
    ["sizeSqm", { sizeSqm: "abc" }],
    ["deposit", { deposit: "100001" }],
    ["flatmates", { flatmates: "21" }],
    ["title", { title: "x".repeat(121) }],
    ["location", { location: "x".repeat(121) }],
    ["description", { description: "x".repeat(2001) }],
    ["roomType", { roomType: "vila" }],
    ["district", { district: "Maribor" }],
    ["availableFrom", { availableFrom: "1.9.2026" }],
    ["availableFrom", { availableFrom: "2026-02-30" }],
    ["availableFrom", { availableFrom: "2026-13-01" }],
  ])("rejects an invalid %s", (field, overrides) => {
    expect(Object.keys(errorsFor(draft(overrides)))).toEqual([field]);
  });

  it("accepts the upper limits", () => {
    expect(
      validateListingDraft(
        draft({
          price: "100000",
          deposit: "100000",
          sizeSqm: "1000",
          flatmates: "20",
          title: "x".repeat(120),
          location: "x".repeat(120),
          description: "x".repeat(2000),
        }),
      ).ok,
    ).toBe(true);
  });

  it("uses the Android date message", () => {
    expect(errorsFor(draft({ availableFrom: "jutri" })).availableFrom).toBe(
      "Datum vselitve vpiši v obliki LLLL-MM-DD.",
    );
  });
});

describe("input helpers", () => {
  it("keeps digits only in numeric inputs", () => {
    expect(digitsOnly("1 200 €")).toBe("1200");
    expect(digitsOnly("-12.5")).toBe("125");
  });

  it("validates real calendar dates", () => {
    expect(isValidIsoDate("2028-02-29")).toBe(true);
    expect(isValidIsoDate("2026-02-29")).toBe(false);
    expect(isValidIsoDate("2026-9-1")).toBe(false);
  });
});

const values = (validateListingDraft(draft()) as { values: ListingValues })
  .values;

function makeClient({
  user = { id: "owner-1" } as { id: string } | null,
  result = { data: { id: "listing-9" }, error: null } as
    { data: { id: string } | null; error: unknown } | Error,
} = {}) {
  const insert = vi.fn();
  const select = vi.fn();
  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user }, error: null })) },
    from: vi.fn(() => ({
      insert: (row: unknown) => {
        insert(row);
        return {
          select: (columns: string) => {
            select(columns);
            return {
              single: () =>
                result instanceof Error
                  ? Promise.reject(result)
                  : Promise.resolve(result),
            };
          },
        };
      },
    })),
  };
  return { client: client as unknown as ListingCreateClient, insert, select };
}

describe("createListing", () => {
  it("inserts the listing with the verified user as owner and returns the id", async () => {
    const { client, insert, select } = makeClient();
    await expect(createListing(client, values)).resolves.toBe("listing-9");
    expect(client.from).toHaveBeenCalledWith("listings");
    expect(insert).toHaveBeenCalledWith({ ...values, owner_id: "owner-1" });
    expect(select).toHaveBeenCalledWith("id");
  });

  it("never lets the form choose the owner, id, or filled state", async () => {
    const { client, insert } = makeClient();
    await createListing(client, values);
    const row = insert.mock.calls[0][0];
    expect(row.owner_id).toBe("owner-1");
    expect(row).not.toHaveProperty("id");
    expect(row).not.toHaveProperty("is_filled");
    expect(row).not.toHaveProperty("created_at");
  });

  it("refuses to insert without a signed-in user", async () => {
    const { client, insert } = makeClient({ user: null });
    await expect(createListing(client, values)).rejects.toMatchObject({
      kind: "signed-out",
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it.each([
    [
      { code: "42501", message: "new row violates row-level security" },
      "permission",
    ],
    [{ code: "22007", message: "invalid date" }, "invalid"],
    [{ code: "23502", message: "null value" }, "invalid"],
    [{ code: "XX000", message: "internal" }, "unknown"],
  ])("maps database error %o to %s", async (error, kind) => {
    const { client } = makeClient({ result: { data: null, error } });
    const failure = await createListing(client, values).catch((e) => e);
    expect(failure).toBeInstanceOf(ListingSaveError);
    expect(failure).toMatchObject({
      kind,
      message:
        listingSaveErrorMessages[kind as keyof typeof listingSaveErrorMessages],
    });
    expect(failure.message).not.toContain(error.message);
  });

  it("maps network failures to the offline message", async () => {
    const { client } = makeClient({ result: new TypeError("Failed to fetch") });
    await expect(createListing(client, values)).rejects.toMatchObject({
      kind: "offline",
    });
  });

  it("treats a missing id in the response as a failure", async () => {
    const { client } = makeClient({ result: { data: null, error: null } });
    await expect(createListing(client, values)).rejects.toMatchObject({
      kind: "unknown",
    });
  });
});
