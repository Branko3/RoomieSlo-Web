import { describe, expect, it, vi } from "vitest";
import { MESSAGE_COLUMNS } from "../lib/chat/messages";
import {
  appendMessage,
  MAX_MESSAGE_LENGTH,
  sendMessage,
  sendMessageCopy,
  SendMessageError,
  validateDraft,
  type SendMessageClient,
} from "../lib/chat/send-message";
import type { Row } from "../lib/supabase/types";

const ME = "me";

function stored(body: string, id = "new"): Row<"messages"> {
  return {
    id,
    match_id: "m1",
    sender_id: ME,
    body,
    delivery_status: "sent",
    sent_at: "2026-10-11T20:00:00Z",
  };
}

function makeClient({
  user = { id: ME } as { id: string } | null,
  result = undefined as
    { data: Row<"messages"> | null; error: unknown } | Error | undefined,
} = {}) {
  const insert = vi.fn();
  const select = vi.fn();
  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user }, error: null })) },
    from: () => ({
      insert: (row: { body: string }) => {
        insert(row);
        return {
          select: (columns: string) => {
            select(columns);
            return {
              single: () => {
                const value = result ?? { data: stored(row.body), error: null };
                return value instanceof Error
                  ? Promise.reject(value)
                  : Promise.resolve(value);
              },
            };
          },
        };
      },
    }),
  };
  return { client: client as unknown as SendMessageClient, insert, select };
}

describe("validateDraft (Android send)", () => {
  it("trims the draft and refuses empty messages", () => {
    expect(validateDraft("  Živjo!\n ")).toEqual({ ok: true, body: "Živjo!" });
    expect(validateDraft("   \n\t")).toEqual({ ok: false, reason: "empty" });
  });

  it("keeps inner line breaks", () => {
    expect(validateDraft("vrstica 1\nvrstica 2")).toEqual({
      ok: true,
      body: "vrstica 1\nvrstica 2",
    });
  });

  it("enforces the length limit after trimming", () => {
    expect(validateDraft(` ${"x".repeat(MAX_MESSAGE_LENGTH)} `).ok).toBe(true);
    expect(validateDraft("x".repeat(MAX_MESSAGE_LENGTH + 1))).toEqual({
      ok: false,
      reason: "too-long",
    });
  });
});

describe("sendMessage (Android ChatRepository.sendMessage)", () => {
  it("inserts the trimmed body as the current user and returns the stored row", async () => {
    const { client, insert, select } = makeClient();
    await expect(sendMessage(client, "m1", "  Živjo  ")).resolves.toMatchObject(
      {
        id: "new",
        body: "Živjo",
        sender_id: ME,
      },
    );
    expect(insert).toHaveBeenCalledWith({
      match_id: "m1",
      sender_id: ME,
      body: "Živjo",
    });
    expect(select).toHaveBeenCalledWith(MESSAGE_COLUMNS);
  });

  it("never calls the server for an empty or too long draft", async () => {
    const { client, insert } = makeClient();
    await expect(sendMessage(client, "m1", "   ")).rejects.toBeInstanceOf(
      SendMessageError,
    );
    await expect(
      sendMessage(client, "m1", "x".repeat(MAX_MESSAGE_LENGTH + 1)),
    ).rejects.toMatchObject({
      kind: "too-long",
      message: sendMessageCopy.tooLong,
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it("requires a signed-in user", async () => {
    const { client, insert } = makeClient({ user: null });
    await expect(sendMessage(client, "m1", "Živjo")).rejects.toMatchObject({
      kind: "signed-out",
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it("reports an RLS refusal as not allowed", async () => {
    const { client } = makeClient({
      result: { data: null, error: { code: "42501", message: "rls" } },
    });
    await expect(sendMessage(client, "m1", "Živjo")).rejects.toMatchObject({
      kind: "not-allowed",
      message: "V ta pogovor ne moreš pisati.",
    });
  });

  it("uses Android's failure copy and the offline copy", async () => {
    await expect(
      sendMessage(
        makeClient({
          result: { data: null, error: { code: "XX000", message: "internal" } },
        }).client,
        "m1",
        "x",
      ),
    ).rejects.toMatchObject({
      kind: "failed",
      message: "Sporočila ni bilo mogoče poslati.",
    });
    await expect(
      sendMessage(
        makeClient({ result: new TypeError("Failed to fetch") }).client,
        "m1",
        "x",
      ),
    ).rejects.toMatchObject({ kind: "offline" });
    await expect(
      sendMessage(
        makeClient({ result: { data: null, error: null } }).client,
        "m1",
        "x",
      ),
    ).rejects.toMatchObject({ kind: "failed" });
  });

  it("rejects a malformed stored row instead of rendering it", async () => {
    const { client } = makeClient({
      result: { data: { ...stored("x"), sent_at: "" }, error: null },
    });
    await expect(sendMessage(client, "m1", "x")).rejects.toMatchObject({
      kind: "failed",
    });
  });
});

describe("appendMessage", () => {
  const history = { myUserId: ME, messages: [stored("a", "1")] };

  it("appends a new message", () => {
    expect(
      appendMessage(history, stored("b", "2"))?.messages.map((m) => m.id),
    ).toEqual(["1", "2"]);
  });

  it("does not duplicate a message already in the history (Android dedupe)", () => {
    expect(appendMessage(history, stored("a", "1"))).toBe(history);
  });

  it("leaves an unloaded history alone", () => {
    expect(appendMessage(undefined, stored("b", "2"))).toBeUndefined();
  });
});
