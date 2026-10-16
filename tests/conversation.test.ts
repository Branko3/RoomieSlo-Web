import { describe, expect, it, vi } from "vitest";
import {
  conversationNotice,
  isMatchId,
  loadConversation,
  PEER_LISTING_LIMIT,
  type Conversation,
  type ConversationClient,
} from "../lib/chat/conversation";
import type { Row } from "../lib/supabase/types";

const ME = "11111111-1111-4111-8111-111111111111";
const PEER = "22222222-2222-4222-8222-222222222222";
const MATCH = "33333333-3333-4333-8333-333333333333";

function listingRow(
  id: string,
  extra: Partial<Row<"listings">> = {},
): Row<"listings"> {
  return {
    id,
    owner_id: PEER,
    location: "Ljubljana",
    price_per_month: 350,
    description: "",
    is_filled: false,
    version: 1,
    created_at: "2026-10-01T00:00:00Z",
    title: `Soba ${id}`,
    room_type: "soba",
    district: "Vič",
    available_from: null,
    size_sqm: null,
    deposit: null,
    bills_included: false,
    furnished: false,
    flatmates_count: 0,
    photo_url: "",
    ...extra,
  };
}

type Result<T> = { data: T | null; error: unknown } | Error;
const settle = <T>(result: Result<T>) =>
  result instanceof Error ? Promise.reject(result) : Promise.resolve(result);

function makeClient({
  user = { id: ME } as { id: string } | null,
  match = {
    data: {
      id: MATCH,
      user_id_a: PEER,
      user_id_b: ME,
      status: "accepted",
      created_at: "2026-09-14T08:00:00Z",
    },
    error: null,
  } as Result<{
    id: string;
    user_id_a: string;
    user_id_b: string;
    status: string;
    created_at?: string;
  }>,
  peer = {
    data: {
      id: PEER,
      display_name: "Ana K.",
      academic_status_verified: true,
      faculty: "FRI",
    },
    error: null,
  } as Result<Record<string, unknown>>,
  listings = { data: [listingRow("l1")], error: null } as Result<
    Row<"listings">[]
  >,
} = {}) {
  const calls: Array<[string, unknown[]]> = [];
  const chain = (table: string) => {
    const builder: Record<string, unknown> = {};
    const record =
      (name: string) =>
      (...args: unknown[]) => {
        calls.push([`${table}.${name}`, args]);
        return builder;
      };
    for (const name of ["select", "eq", "order"]) builder[name] = record(name);
    builder.maybeSingle = () => {
      calls.push([`${table}.maybeSingle`, []]);
      return settle(table === "matches" ? match : peer);
    };
    builder.limit = (count: number) => {
      calls.push([`${table}.limit`, [count]]);
      return settle(listings);
    };
    return builder;
  };
  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user }, error: null })) },
    from: (table: string) => chain(table),
  };
  return { client: client as unknown as ConversationClient, calls };
}

describe("isMatchId", () => {
  it("accepts UUIDs only", () => {
    expect(isMatchId(MATCH)).toBe(true);
    expect(isMatchId("iva")).toBe(false);
    expect(isMatchId("")).toBe(false);
    expect(isMatchId(`${MATCH}x`)).toBe(false);
  });
});

describe("loadConversation", () => {
  it("resolves an accepted match with the other person and listing context", async () => {
    const { client, calls } = makeClient();
    const conversation = await loadConversation(client, MATCH);
    expect(conversation).toMatchObject({
      status: "accepted",
      matchId: MATCH,
      matchCreatedAt: "2026-09-14T08:00:00Z",
      iAmRecipient: true,
      peer: { id: PEER, name: "Ana K.", verified: true, faculty: "FRI" },
    });
    expect(
      conversation.status === "accepted" &&
        conversation.peerListings.map((l) => l.id),
    ).toEqual(["l1"]);
    expect(calls).toContainEqual(["matches.eq", ["id", MATCH]]);
    expect(calls).toContainEqual(["profiles.eq", ["id", PEER]]);
    expect(calls).toContainEqual(["listings.eq", ["owner_id", PEER]]);
    expect(calls).toContainEqual(["listings.eq", ["is_filled", false]]);
    expect(calls).toContainEqual(["listings.limit", [PEER_LISTING_LIMIT]]);
  });

  it("marks a deleted peer and still opens the conversation", async () => {
    const { client, calls } = makeClient({
      peer: {
        data: {
          id: PEER,
          display_name: "Izbrisan uporabnik",
          academic_status_verified: false,
          faculty: "",
          deleted_at: "2026-10-14T00:00:00Z",
        },
        error: null,
      },
    });
    await expect(loadConversation(client, MATCH)).resolves.toMatchObject({
      status: "accepted",
      peer: { name: "Izbrisan uporabnik", deleted: true, verified: false },
    });
    expect(calls).toContainEqual([
      "profiles.select",
      ["id,display_name,academic_status_verified,faculty,deleted_at"],
    ]);
  });

  it("treats a profile without deleted_at as active", async () => {
    await expect(
      loadConversation(makeClient().client, MATCH),
    ).resolves.toMatchObject({ peer: { deleted: false } });
  });

  it("identifies the peer when I sent the request", async () => {
    const { client } = makeClient({
      match: {
        data: { id: MATCH, user_id_a: ME, user_id_b: PEER, status: "pending" },
        error: null,
      },
    });
    await expect(loadConversation(client, MATCH)).resolves.toMatchObject({
      status: "pending",
      iAmRecipient: false,
      peer: { id: PEER },
    });
  });

  it("treats invalid ids, missing matches, and other people's matches as not found", async () => {
    const invalid = makeClient();
    await expect(loadConversation(invalid.client, "iva")).resolves.toEqual({
      status: "not-found",
    });
    expect(invalid.calls).toEqual([]);

    await expect(
      loadConversation(
        makeClient({ match: { data: null, error: null } }).client,
        MATCH,
      ),
    ).resolves.toEqual({ status: "not-found" });

    await expect(
      loadConversation(
        makeClient({
          match: {
            data: {
              id: MATCH,
              user_id_a: PEER,
              user_id_b: "someone-else",
              status: "accepted",
            },
            error: null,
          },
        }).client,
        MATCH,
      ),
    ).resolves.toEqual({ status: "not-found" });
  });

  it("requires a signed-in user", async () => {
    const { client, calls } = makeClient({ user: null });
    await expect(loadConversation(client, MATCH)).resolves.toEqual({
      status: "signed-out",
    });
    expect(calls).toEqual([]);
  });

  it("falls back to a neutral name and empty profile details", async () => {
    const { client } = makeClient({ peer: { data: null, error: null } });
    await expect(loadConversation(client, MATCH)).resolves.toMatchObject({
      peer: { name: "Uporabnik", verified: false, faculty: "" },
    });
  });

  it("does not block the chat when listing context fails or is malformed", async () => {
    const failed = await loadConversation(
      makeClient({ listings: { data: null, error: { code: "XX000" } } }).client,
      MATCH,
    );
    expect(failed.status === "accepted" && failed.peerListings).toEqual([]);

    const malformed = await loadConversation(
      makeClient({
        listings: {
          data: [listingRow("ok"), listingRow("bad", { created_at: "" })],
          error: null,
        },
      }).client,
      MATCH,
    );
    expect(
      malformed.status === "accepted" &&
        malformed.peerListings.map((l) => l.id),
    ).toEqual(["ok"]);
  });

  it("maps failures to safe messages", async () => {
    await expect(
      loadConversation(
        makeClient({ match: new TypeError("Failed to fetch") }).client,
        MATCH,
      ),
    ).rejects.toMatchObject({
      kind: "offline",
      message: "Ni povezave. Klepeta ni bilo mogoče odpreti.",
    });
    await expect(
      loadConversation(
        makeClient({
          match: { data: null, error: { code: "XX000", message: "internal" } },
        }).client,
        MATCH,
      ),
    ).rejects.toMatchObject({
      kind: "failed",
      message: "Klepeta ni bilo mogoče odpreti.",
    });
    await expect(
      loadConversation(
        makeClient({ peer: { data: null, error: { code: "42501" } } }).client,
        MATCH,
      ),
    ).rejects.toMatchObject({ kind: "failed" });
  });
});

describe("conversationNotice", () => {
  const base = {
    matchId: MATCH,
    matchCreatedAt: null,
    peer: {
      id: PEER,
      name: "Ana",
      verified: false,
      faculty: "",
      deleted: false,
    },
    peerListings: [],
  };

  it("explains pending requests from both sides and rejected requests", () => {
    expect(
      conversationNotice({ ...base, status: "pending", iAmRecipient: false }),
    ).toBe(
      "Zahteva še čaka na odgovor. Pogovor se odpre, ko jo druga oseba sprejme.",
    );
    expect(
      conversationNotice({ ...base, status: "pending", iAmRecipient: true }),
    ).toBe(
      "Ta oseba ti je poslala zahtevo za ujemanje. Sprejmi jo med klepeti, da odpreš pogovor.",
    );
    expect(
      conversationNotice({ ...base, status: "rejected", iAmRecipient: false }),
    ).toBe("Zahteva za ujemanje je bila zavrnjena, zato pogovor ni na voljo.");
  });

  it("has no notice for an open conversation or non-conversation states", () => {
    expect(
      conversationNotice({ ...base, status: "accepted", iAmRecipient: true }),
    ).toBeNull();
    expect(
      conversationNotice({ status: "not-found" } as Conversation),
    ).toBeNull();
    expect(
      conversationNotice({ status: "signed-out" } as Conversation),
    ).toBeNull();
  });
});
