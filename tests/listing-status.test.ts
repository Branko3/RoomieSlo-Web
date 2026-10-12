import { describe, expect, it, vi } from "vitest";
import {
  canRequestMatch,
  filledToggleLabel,
  ListingStatusError,
  listingStatusLabel,
  setListingFilled,
  statusErrorMessages,
  toggleFilledOptimistically,
  type ListingStatusClient,
} from "../lib/listings/listing-status";

type Result =
  { data: { id: string; is_filled: boolean } | null; error: unknown } | Error;

function makeClient({
  user = { id: "owner-1" } as { id: string } | null,
  result = {
    data: { id: "listing-1", is_filled: true },
    error: null,
  } as Result,
} = {}) {
  const calls: Array<[string, unknown[]]> = [];
  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user }, error: null })) },
    from: vi.fn((table: string) => {
      calls.push(["from", [table]]);
      return {
        update: (values: unknown) => {
          calls.push(["update", [values]]);
          return {
            eq: (column: string, value: string) => {
              calls.push(["eq", [column, value]]);
              return {
                eq: (column2: string, value2: string) => {
                  calls.push(["eq", [column2, value2]]);
                  return {
                    select: (columns: string) => {
                      calls.push(["select", [columns]]);
                      return {
                        maybeSingle: () =>
                          result instanceof Error
                            ? Promise.reject(result)
                            : Promise.resolve(result),
                      };
                    },
                  };
                },
              };
            },
          };
        },
      };
    }),
  };
  return { client: client as unknown as ListingStatusClient, calls };
}

describe("Android labels", () => {
  it("shows the status chip and toggle copy from the Android detail screen", () => {
    expect(listingStatusLabel(true)).toBe("Zapolnjeno");
    expect(listingStatusLabel(false)).toBe("Na voljo");
    expect(filledToggleLabel(false)).toBe("Označi kot zapolnjeno");
    expect(filledToggleLabel(true)).toBe("Označi kot na voljo");
  });

  it("allows match requests only for available listings", () => {
    expect(canRequestMatch(false)).toBe(true);
    expect(canRequestMatch(true)).toBe(false);
  });
});

describe("setListingFilled", () => {
  it("updates only is_filled on the verified owner's listing", async () => {
    const { client, calls } = makeClient();
    await expect(setListingFilled(client, "listing-1", true)).resolves.toBe(
      true,
    );
    expect(calls).toEqual([
      ["from", ["listings"]],
      ["update", [{ is_filled: true }]],
      ["eq", ["id", "listing-1"]],
      ["eq", ["owner_id", "owner-1"]],
      ["select", ["id,is_filled"]],
    ]);
  });

  it("returns the state confirmed by the database", async () => {
    const { client } = makeClient({
      result: { data: { id: "listing-1", is_filled: false }, error: null },
    });
    await expect(setListingFilled(client, "listing-1", false)).resolves.toBe(
      false,
    );
  });

  it("reports when nothing was updated (missing listing or not the owner)", async () => {
    const { client } = makeClient({ result: { data: null, error: null } });
    await expect(
      setListingFilled(client, "listing-1", true),
    ).rejects.toMatchObject({
      kind: "gone",
      message: statusErrorMessages.gone,
    });
  });

  it("requires a signed-in user and an id before any request", async () => {
    const signedOut = makeClient({ user: null });
    await expect(
      setListingFilled(signedOut.client, "listing-1", true),
    ).rejects.toMatchObject({ kind: "signed-out" });
    expect(signedOut.calls).toEqual([]);

    const noId = makeClient();
    await expect(setListingFilled(noId.client, "", true)).rejects.toMatchObject(
      { kind: "gone" },
    );
    expect(noId.calls).toEqual([]);
  });

  it.each([
    [{ code: "42501", message: "rls" }, "permission"],
    [{ code: "XX000", message: "internal detail" }, "unknown"],
  ])("maps %o to %s without leaking details", async (dbError, kind) => {
    const { client } = makeClient({ result: { data: null, error: dbError } });
    const error = await setListingFilled(client, "listing-1", true).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ListingStatusError);
    expect(error).toMatchObject({ kind });
    expect((error as Error).message).not.toMatch(/internal detail|rls/);
  });

  it("maps network failures to offline", async () => {
    const { client } = makeClient({ result: new TypeError("Failed to fetch") });
    await expect(
      setListingFilled(client, "listing-1", true),
    ).rejects.toMatchObject({ kind: "offline" });
  });
});

describe("toggleFilledOptimistically", () => {
  it("applies the new state immediately and settles on the confirmed value", async () => {
    const applied: boolean[] = [];
    let resolve!: (value: boolean) => void;
    const pending = toggleFilledOptimistically(
      false,
      (value) => applied.push(value),
      () => new Promise<boolean>((r) => (resolve = r)),
    );
    expect(applied).toEqual([true]);
    resolve(true);
    await expect(pending).resolves.toEqual({ ok: true, filled: true });
    expect(applied).toEqual([true, true]);
  });

  it("rolls back to the previous state when saving fails", async () => {
    const applied: boolean[] = [];
    const result = await toggleFilledOptimistically(
      true,
      (value) => applied.push(value),
      () => Promise.reject(new TypeError("Failed to fetch")),
    );
    expect(applied).toEqual([false, true]);
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.error.kind).toBe("offline");
  });

  it("passes the toggled value to persistence", async () => {
    const persist = vi.fn().mockResolvedValue(false);
    await toggleFilledOptimistically(true, () => undefined, persist);
    expect(persist).toHaveBeenCalledWith(false);
  });
});
