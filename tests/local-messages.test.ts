import { describe, expect, it } from "vitest";
import {
  addLocal,
  confirmLocal,
  createLocalMessage,
  failLocal,
  findLocal,
  isLocal,
  newLocalId,
  removeLocal,
  retryLocal,
  type ChatHistory,
} from "../lib/chat/local-messages";
import type { Message } from "../lib/supabase/mappers";

const ME = "me";
const NOW = new Date("2026-10-11T20:00:00Z");

function stored(id: string, body = "Živjo"): Message {
  return {
    id,
    match_id: "m1",
    sender_id: ME,
    body,
    delivery_status: "sent",
    sent_at: "2026-10-11T20:00:01Z",
  };
}

const history = (): ChatHistory => ({
  myUserId: ME,
  messages: [stored("old", "Prejšnje")],
});

const ids = (h: ChatHistory | undefined) =>
  h?.messages.map((m) => (isLocal(m) ? `${m.localId}:${m.localState}` : m.id));

describe("createLocalMessage", () => {
  it("builds a sending message for the current user with a client-only id", () => {
    const local = createLocalMessage("m1", ME, "Živjo", NOW, "local-1");
    expect(local).toEqual({
      id: "local-1",
      localId: "local-1",
      localState: "sending",
      match_id: "m1",
      sender_id: ME,
      body: "Živjo",
      delivery_status: "sent",
      sent_at: "2026-10-11T20:00:00.000Z",
    });
    expect(isLocal(local)).toBe(true);
    expect(isLocal(stored("x"))).toBe(false);
  });

  it("generates unique local ids", () => {
    const a = newLocalId();
    const b = newLocalId();
    expect(a).toMatch(/^local-/);
    expect(a).not.toBe(b);
  });
});

describe("local message lifecycle", () => {
  it("shows the message immediately at the end of the conversation", () => {
    const local = createLocalMessage("m1", ME, "Živjo", NOW, "local-1");
    expect(ids(addLocal(history(), local))).toEqual(["old", "local-1:sending"]);
  });

  it("replaces the local copy with the stored message on success", () => {
    const local = createLocalMessage("m1", ME, "Živjo", NOW, "local-1");
    const confirmed = confirmLocal(
      addLocal(history(), local),
      "local-1",
      stored("srv-1"),
    );
    expect(ids(confirmed)).toEqual(["old", "srv-1"]);
  });

  it("drops the local copy if the stored message already arrived (e.g. via Realtime)", () => {
    const local = createLocalMessage("m1", ME, "Živjo", NOW, "local-1");
    const withBoth = {
      ...history(),
      messages: [...addLocal(history(), local)!.messages, stored("srv-1")],
    };
    expect(ids(confirmLocal(withBoth, "local-1", stored("srv-1")))).toEqual([
      "old",
      "srv-1",
    ]);
  });

  it("keeps a failed message visible, then retries and confirms it", () => {
    const local = createLocalMessage("m1", ME, "Živjo", NOW, "local-1");
    let state = addLocal(history(), local);
    state = failLocal(state, "local-1");
    expect(ids(state)).toEqual(["old", "local-1:failed"]);
    expect(findLocal(state, "local-1")?.body).toBe("Živjo");
    state = retryLocal(state, "local-1");
    expect(ids(state)).toEqual(["old", "local-1:sending"]);
    expect(ids(confirmLocal(state, "local-1", stored("srv-1")))).toEqual([
      "old",
      "srv-1",
    ]);
  });

  it("discards a failed message", () => {
    const local = createLocalMessage("m1", ME, "Živjo", NOW, "local-1");
    const state = failLocal(addLocal(history(), local), "local-1");
    expect(ids(removeLocal(state, "local-1"))).toEqual(["old"]);
  });

  it("tracks several messages in flight independently and in order", () => {
    const first = createLocalMessage("m1", ME, "Ena", NOW, "local-1");
    const second = createLocalMessage("m1", ME, "Dva", NOW, "local-2");
    let state = addLocal(addLocal(history(), first), second);
    state = confirmLocal(state, "local-2", stored("srv-2", "Dva"));
    state = failLocal(state, "local-1");
    expect(ids(state)).toEqual(["old", "local-1:failed", "srv-2"]);
  });

  it("ignores unknown local ids and unloaded histories", () => {
    const state = history();
    expect(failLocal(state, "missing")).toEqual(state);
    expect(removeLocal(state, "missing")).toEqual(state);
    expect(findLocal(state, "missing")).toBeUndefined();
    const local = createLocalMessage("m1", ME, "x", NOW, "local-1");
    expect(addLocal(undefined, local)).toBeUndefined();
    expect(confirmLocal(undefined, "local-1", stored("s"))).toBeUndefined();
    expect(failLocal(undefined, "local-1")).toBeUndefined();
    expect(retryLocal(undefined, "local-1")).toBeUndefined();
    expect(removeLocal(undefined, "local-1")).toBeUndefined();
  });

  it("never changes server messages", () => {
    const state = history();
    expect(retryLocal(state, "old")).toEqual(state);
    expect(removeLocal(state, "old")).toEqual(state);
  });
});
