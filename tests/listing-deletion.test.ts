import { describe, expect, it, vi } from "vitest";
import {
  deleteErrorMessages,
  deleteListing,
  ListingDeleteError,
  type ListingDeleteClient,
} from "../lib/listings/listing-delete";

type Result = { data: { id: string }[] | null; error: unknown } | Error;

function makeClient({
  user = { id: "owner-1" } as { id: string } | null,
  result = { data: [{ id: "listing-1" }], error: null } as Result,
} = {}) {
  const calls: Array<[string, unknown[]]> = [];
  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user }, error: null })) },
    from: vi.fn((table: string) => {
      calls.push(["from", [table]]);
      return {
        delete: () => {
          calls.push(["delete", []]);
          return {
            eq: (column: string, value: string) => {
              calls.push(["eq", [column, value]]);
              return {
                eq: (column2: string, value2: string) => {
                  calls.push(["eq", [column2, value2]]);
                  return {
                    select: (columns: string) => {
                      calls.push(["select", [columns]]);
                      return result instanceof Error
                        ? Promise.reject(result)
                        : Promise.resolve(result);
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
  return { client: client as unknown as ListingDeleteClient, calls };
}

describe("deleteListing", () => {
  it("deletes only the current owner's listing and confirms the deleted row", async () => {
    const { client, calls } = makeClient();
    await expect(deleteListing(client, "listing-1")).resolves.toBeUndefined();
    expect(calls).toEqual([
      ["from", ["listings"]],
      ["delete", []],
      ["eq", ["id", "listing-1"]],
      ["eq", ["owner_id", "owner-1"]],
      ["select", ["id"]],
    ]);
  });

  it("takes the owner from the verified user, not from the caller", async () => {
    const { client, calls } = makeClient({ user: { id: "someone-else" } });
    await deleteListing(client, "listing-1").catch(() => undefined);
    expect(calls).toContainEqual(["eq", ["owner_id", "someone-else"]]);
  });

  it("does not claim success when nothing was deleted (missing or not owner)", async () => {
    const { client } = makeClient({ result: { data: [], error: null } });
    await expect(deleteListing(client, "listing-1")).rejects.toMatchObject({
      kind: "gone",
      message: deleteErrorMessages.gone,
    });
    const { client: nullData } = makeClient({
      result: { data: null, error: null },
    });
    await expect(deleteListing(nullData, "listing-1")).rejects.toMatchObject({
      kind: "gone",
    });
  });

  it("requires a signed-in user and a listing id before calling the database", async () => {
    const signedOut = makeClient({ user: null });
    await expect(
      deleteListing(signedOut.client, "listing-1"),
    ).rejects.toMatchObject({ kind: "signed-out" });
    expect(signedOut.calls).toEqual([]);

    const noId = makeClient();
    await expect(deleteListing(noId.client, "")).rejects.toMatchObject({
      kind: "gone",
    });
    expect(noId.calls).toEqual([]);
  });

  it.each([
    [{ error: { code: "42501", message: "rls" } }, "permission"],
    [{ error: { status: 403 } }, "permission"],
    [{ error: { code: "XX000", message: "internal detail" } }, "unknown"],
  ])("maps %o to %s without leaking details", async (failure, kind) => {
    const { client } = makeClient({
      result: { data: null, ...failure },
    });
    const error = await deleteListing(client, "listing-1").catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ListingDeleteError);
    expect(error).toMatchObject({ kind });
    expect((error as Error).message).not.toMatch(/internal detail|rls/);
  });

  it("maps network failures to offline", async () => {
    const { client } = makeClient({ result: new TypeError("Failed to fetch") });
    await expect(deleteListing(client, "listing-1")).rejects.toMatchObject({
      kind: "offline",
      message: deleteErrorMessages.offline,
    });
  });
});

describe("delete copy", () => {
  it("uses Slovenian messages", () => {
    expect(deleteErrorMessages.unknown).toBe(
      "Oglasa ni bilo mogoče izbrisati.",
    );
    for (const message of Object.values(deleteErrorMessages)) {
      expect(message.length).toBeGreaterThan(10);
    }
  });
});
