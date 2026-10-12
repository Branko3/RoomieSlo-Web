import { describe, expect, it, vi } from "vitest";
import {
  dropLocal,
  mergeServerHistory,
  newMessageId,
  upsertStored,
} from "../lib/chat/dedupe";
import {
  addLocal,
  createLocalMessage,
  failLocal,
  isLocal,
  retryLocal,
  type ChatHistory,
} from "../lib/chat/local-messages";
import {
  sendMessage,
  SendMessageError,
  type SendMessageClient,
} from "../lib/chat/send-message";
import type { Message } from "../lib/supabase/mappers";
import type { Row } from "../lib/supabase/types";

const ME = "me";
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function server(
  id: string,
  sentAt: string,
  extra: Partial<Message> = {},
): Message {
  return {
    id,
    match_id: "m1",
    sender_id: ME,
    body: "ok",
    delivery_status: "sent",
    sent_at: sentAt,
    ...extra,
  };
}

function base(): ChatHistory {
  return {
    myUserId: ME,
    messages: [server("old", "2026-10-11T20:00:00Z", { sender_id: "peer" })],
  };
}

function local(id: string, body = "ok", at = "2026-10-11T20:01:00Z") {
  return createLocalMessage("m1", ME, body, new Date(at), id);
}

const view = (history: ChatHistory | undefined) =>
  history?.messages.map((m) => (isLocal(m) ? `${m.id}:${m.localState}` : m.id));

describe("newMessageId", () => {
  it("generates RFC 4122 v4 UUIDs, unique per call", () => {
    const ids = new Set(Array.from({ length: 50 }, () => newMessageId()));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(UUID);
  });

  it("falls back when crypto.randomUUID is unavailable", () => {
    const original = globalThis.crypto.randomUUID;
    Object.defineProperty(globalThis.crypto, "randomUUID", {
      value: undefined,
      configurable: true,
    });
    try {
      expect(newMessageId()).toMatch(UUID);
    } finally {
      Object.defineProperty(globalThis.crypto, "randomUUID", {
        value: original,
        configurable: true,
      });
    }
  });
});

describe("optimistic send with Realtime echo (any order)", () => {
  it("echo first, then insert response: shown once", () => {
    let h = addLocal(base(), local("u1"));
    h = upsertStored(h, server("u1", "2026-10-11T20:01:01Z")); // Realtime echo
    h = upsertStored(h, server("u1", "2026-10-11T20:01:01Z")); // insert response
    expect(view(h)).toEqual(["old", "u1"]);
  });

  it("insert response first, then echo: shown once", () => {
    let h = addLocal(base(), local("u1"));
    h = upsertStored(h, server("u1", "2026-10-11T20:01:01Z"));
    h = upsertStored(h, server("u1", "2026-10-11T20:01:01Z"));
    expect(view(h)).toEqual(["old", "u1"]);
  });

  it("keeps identical texts sent in a row as separate messages", () => {
    let h = addLocal(addLocal(base(), local("u1")), local("u2"));
    h = upsertStored(h, server("u2", "2026-10-11T20:01:02Z")); // second confirms first
    h = upsertStored(h, server("u1", "2026-10-11T20:01:01Z"));
    expect(view(h)).toEqual(["old", "u1", "u2"]);
  });

  it("adds the other person's messages in time order", () => {
    const h = upsertStored(
      addLocal(base(), local("u1")),
      server("p1", "2026-10-11T20:00:30Z", { sender_id: "peer" }),
    );
    expect(view(h)).toEqual(["old", "p1", "u1:sending"]);
  });
});

describe("reconnect reconciliation (refetch merge)", () => {
  it("keeps local messages still sending or failed", () => {
    let h = addLocal(addLocal(base(), local("u1")), local("u2", "drugo"));
    h = failLocal(h, "u2");
    const merged = mergeServerHistory(h, {
      myUserId: ME,
      messages: base().messages,
    });
    expect(view(merged)).toEqual(["old", "u1:sending", "u2:failed"]);
  });

  it("drops a local message once the server has it (stored while offline)", () => {
    const h = addLocal(base(), local("u1"));
    const merged = mergeServerHistory(h, {
      myUserId: ME,
      messages: [...base().messages, server("u1", "2026-10-11T20:01:01Z")],
    });
    expect(view(merged)).toEqual(["old", "u1"]);
  });

  it("adds messages missed during the outage in time order", () => {
    const h = addLocal(base(), local("u1", "moje", "2026-10-11T20:05:00Z"));
    const merged = mergeServerHistory(h, {
      myUserId: ME,
      messages: [
        ...base().messages,
        server("p1", "2026-10-11T20:02:00Z", { sender_id: "peer" }),
        server("p2", "2026-10-11T20:06:00Z", { sender_id: "peer" }),
      ],
    });
    expect(view(merged)).toEqual(["old", "p1", "u1:sending", "p2"]);
  });

  it("works for the first load and takes the user id from the server", () => {
    expect(
      mergeServerHistory(undefined, { myUserId: ME, messages: [] }),
    ).toEqual({ myUserId: ME, messages: [] });
  });
});

describe("rollback of a send whose response was lost", () => {
  it("removes the local copy when the retry finds it already stored", () => {
    let h = addLocal(base(), local("u1"));
    h = failLocal(h, "u1");
    h = retryLocal(h, "u1");
    h = dropLocal(h, "u1");
    expect(view(h)).toEqual(["old"]);
    // The refetch then brings the stored copy.
    const merged = mergeServerHistory(h, {
      myUserId: ME,
      messages: [...base().messages, server("u1", "2026-10-11T20:01:01Z")],
    });
    expect(view(merged)).toEqual(["old", "u1"]);
  });

  it("leaves the history alone when there is nothing to drop", () => {
    const h = base();
    expect(dropLocal(h, "missing")).toBe(h);
    expect(dropLocal(undefined, "u1")).toBeUndefined();
    expect(upsertStored(undefined, server("u1", "x"))).toBeUndefined();
  });

  it("never replaces an already stored copy", () => {
    const h = {
      ...base(),
      messages: [
        ...base().messages,
        server("u1", "2026-10-11T20:01:01Z", { delivery_status: "read" }),
      ],
    };
    expect(upsertStored(h, server("u1", "2026-10-11T20:01:01Z"))).toBe(h);
  });
});

describe("sendMessage with a client id (idempotent retry)", () => {
  function client(result: { data: Row<"messages"> | null; error: unknown }) {
    const insert = vi.fn();
    const c = {
      auth: {
        getUser: async () => ({ data: { user: { id: ME } }, error: null }),
      },
      from: () => ({
        insert: (row: unknown) => {
          insert(row);
          return { select: () => ({ single: async () => result }) };
        },
      }),
    };
    return { client: c as unknown as SendMessageClient, insert };
  }

  it("sends the client-generated id with the message", async () => {
    const stored = server("u1", "2026-10-11T20:01:01Z") as Row<"messages">;
    const { client: c, insert } = client({ data: stored, error: null });
    await expect(sendMessage(c, "m1", "ok", "u1")).resolves.toMatchObject({
      id: "u1",
    });
    expect(insert).toHaveBeenCalledWith({
      id: "u1",
      match_id: "m1",
      sender_id: ME,
      body: "ok",
    });
  });

  it("reports a duplicate id as already sent, not as a failure", async () => {
    const { client: c } = client({
      data: null,
      error: { code: "23505", message: "duplicate key" },
    });
    const error = await sendMessage(c, "m1", "ok", "u1").catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(SendMessageError);
    expect(error).toMatchObject({ kind: "already-sent" });
  });

  it("keeps the old behavior without an id", async () => {
    const { client: c, insert } = client({
      data: null,
      error: { code: "23505" },
    });
    await expect(sendMessage(c, "m1", "ok")).rejects.toMatchObject({
      kind: "failed",
    });
    expect(insert.mock.calls[0][0]).not.toHaveProperty("id");
  });
});
