import { describe, expect, it, vi } from "vitest";
import {
  draftFromListing,
  EDITABLE_COLUMNS,
  LISTING_CONFLICT_MESSAGE,
  ListingConflictError,
  loadListingForEdit,
  updateListing,
  type EditableListingRow,
  type ListingEditClient,
} from "../lib/listings/listing-edit";
import {
  emptyListingDraft,
  listingSaveErrorMessages,
  validateListingDraft,
  type ListingValues,
} from "../lib/listings/listing-form";

const row: EditableListingRow = {
  id: "listing-1",
  owner_id: "owner-1",
  version: 3,
  location: "Ljubljana",
  price_per_month: 350,
  description: "Svetla soba.",
  title: "Soba blizu FRI",
  room_type: "soba",
  district: "Vič",
  available_from: "2026-09-01",
  size_sqm: 14,
  deposit: 400,
  bills_included: true,
  furnished: false,
  flatmates_count: 2,
};

type Result<T> = { data: T | null; error: unknown } | Error;
const settle = <T>(result: Result<T>) =>
  result instanceof Error ? Promise.reject(result) : Promise.resolve(result);

function makeClient({
  user = { id: "owner-1" } as { id: string } | null,
  load = { data: row, error: null } as Result<EditableListingRow>,
  update = { data: { id: "listing-1" }, error: null } as Result<{ id: string }>,
} = {}) {
  const calls: Array<[string, unknown[]]> = [];
  const record =
    (name: string) =>
    (...args: unknown[]) =>
      calls.push([name, args]);
  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user }, error: null })) },
    from: vi.fn(() => ({
      select: (columns: string) => {
        record("select")(columns);
        return {
          eq: (column: string, value: string) => {
            record("eq")(column, value);
            return { maybeSingle: () => settle(load) };
          },
        };
      },
      update: (values: unknown) => {
        record("update")(values);
        return {
          eq: (column: string, value: string) => {
            record("eq")(column, value);
            return {
              eq: (column2: string, value2: number) => {
                record("eq")(column2, value2);
                return {
                  select: (columns: string) => {
                    record("select")(columns);
                    return { maybeSingle: () => settle(update) };
                  },
                };
              },
            };
          },
        };
      },
    })),
  };
  return { client: client as unknown as ListingEditClient, calls };
}

const values = (
  validateListingDraft({
    ...emptyListingDraft,
    location: "Maribor",
    price: "300",
  }) as { values: ListingValues }
).values;

describe("draftFromListing", () => {
  it("prefills every field like Android", () => {
    expect(draftFromListing(row)).toEqual({
      location: "Ljubljana",
      price: "350",
      description: "Svetla soba.",
      title: "Soba blizu FRI",
      roomType: "soba",
      district: "Vič",
      availableFrom: "2026-09-01",
      sizeSqm: "14",
      deposit: "400",
      billsIncluded: true,
      furnished: false,
      flatmates: "2",
    });
  });

  it("shows empty optional fields, whole euros, and hides zero flatmates", () => {
    const draft = draftFromListing({
      ...row,
      price_per_month: 349.99,
      deposit: "250.50" as unknown as number,
      available_from: null,
      size_sqm: null,
      flatmates_count: 0,
    });
    expect(draft).toMatchObject({
      price: "349",
      deposit: "250",
      availableFrom: "",
      sizeSqm: "",
      flatmates: "",
    });
    expect(draftFromListing({ ...row, deposit: null }).deposit).toBe("");
  });

  it("round-trips through validation back to the same values", () => {
    const result = validateListingDraft(draftFromListing(row));
    expect(result).toEqual({
      ok: true,
      values: {
        location: "Ljubljana",
        price_per_month: 350,
        description: "Svetla soba.",
        title: "Soba blizu FRI",
        room_type: "soba",
        district: "Vič",
        available_from: "2026-09-01",
        size_sqm: 14,
        deposit: 400,
        bills_included: true,
        furnished: false,
        flatmates_count: 2,
      },
    });
  });
});

describe("loadListingForEdit", () => {
  it("loads the owner's listing with only the editable columns", async () => {
    const { client, calls } = makeClient();
    await expect(loadListingForEdit(client, "listing-1")).resolves.toEqual({
      status: "ready",
      draft: draftFromListing(row),
      version: 3,
    });
    expect(calls).toEqual([
      ["select", [EDITABLE_COLUMNS]],
      ["eq", ["id", "listing-1"]],
    ]);
  });

  it("refuses to open another user's listing for editing", async () => {
    const { client } = makeClient({ user: { id: "someone-else" } });
    await expect(loadListingForEdit(client, "listing-1")).resolves.toEqual({
      status: "not-owner",
    });
  });

  it("reports a missing listing and an empty id", async () => {
    const { client } = makeClient({ load: { data: null, error: null } });
    await expect(loadListingForEdit(client, "listing-1")).resolves.toEqual({
      status: "not-found",
    });
    const { client: other, calls } = makeClient();
    await expect(loadListingForEdit(other, "")).resolves.toEqual({
      status: "not-found",
    });
    expect(calls).toEqual([]);
  });

  it("requires a signed-in user", async () => {
    const { client, calls } = makeClient({ user: null });
    await expect(loadListingForEdit(client, "listing-1")).rejects.toMatchObject(
      { kind: "signed-out" },
    );
    expect(calls).toEqual([]);
  });

  it("maps load failures to safe messages", async () => {
    const { client } = makeClient({ load: new TypeError("Failed to fetch") });
    await expect(loadListingForEdit(client, "listing-1")).rejects.toMatchObject(
      { kind: "offline", message: listingSaveErrorMessages.offline },
    );
  });
});

describe("updateListing", () => {
  it("updates only editable columns, guarded and bumped by version", async () => {
    const { client, calls } = makeClient();
    await expect(updateListing(client, "listing-1", 3, values)).resolves.toBe(
      4,
    );
    expect(calls).toEqual([
      ["update", [{ ...values, version: 4 }]],
      ["eq", ["id", "listing-1"]],
      ["eq", ["version", 3]],
      ["select", ["id"]],
    ]);
  });

  it("never sends owner, id, filled state, or created_at", async () => {
    const { client, calls } = makeClient();
    await updateListing(client, "listing-1", 3, values);
    const payload = calls[0][1][0] as Record<string, unknown>;
    for (const key of ["owner_id", "id", "is_filled", "created_at"]) {
      expect(payload).not.toHaveProperty(key);
    }
  });

  it("reports a conflict when the version changed, the row was deleted, or RLS hid it", async () => {
    const { client } = makeClient({ update: { data: null, error: null } });
    const error = await updateListing(client, "listing-1", 3, values).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ListingConflictError);
    expect((error as Error).message).toBe(LISTING_CONFLICT_MESSAGE);
  });

  it.each([
    [{ code: "42501", message: "rls" }, "permission"],
    [{ code: "22008", message: "date out of range" }, "invalid"],
    [{ code: "XX000", message: "internal" }, "unknown"],
  ])("maps database error %o to %s", async (dbError, kind) => {
    const { client } = makeClient({ update: { data: null, error: dbError } });
    await expect(
      updateListing(client, "listing-1", 3, values),
    ).rejects.toMatchObject({ kind });
  });

  it("maps network failures to offline", async () => {
    const { client } = makeClient({ update: new TypeError("Failed to fetch") });
    await expect(
      updateListing(client, "listing-1", 3, values),
    ).rejects.toMatchObject({ kind: "offline" });
  });
});
