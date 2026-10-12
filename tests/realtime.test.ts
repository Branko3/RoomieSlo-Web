import { describe, expect, it, vi } from "vitest";
import {
  applyRealtimeInsert,
  applyRealtimeUpdate,
  channelName,
  subscribeToMessages,
  toRealtimeStatus,
  type RealtimeChannelLike,
  type RealtimeClient,
} from "../lib/chat/realtime";
import type { Message } from "../lib/supabase/mappers";

function message(
  id: string,
  sentAt: string,
  extra: Partial<Message> = {},
): Message {
  return {
    id,
    match_id: "m1",
    sender_id: "peer",
    body: `Sporočilo ${id}`,
    delivery_status: "sent",
    sent_at: sentAt,
    ...extra,
  };
}

/** Fake channel that records its subscriptions and lets tests emit events. */
function fakeRealtime() {
  const handlers: Record<string, (payload: { new: unknown }) => void> = {};
  const filters: unknown[] = [];
  let statusCallback: ((status: string) => void) | undefined;
  const channel: RealtimeChannelLike = {
    on: (_type, filter, callback) => {
      filters.push(filter);
      handlers[filter.event] = callback as (payload: { new: unknown }) => void;
      return channel;
    },
    subscribe: (callback) => {
      statusCallback = callback;
      return channel;
    },
  };
  const client: RealtimeClient = {
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(),
  };
  return {
    client,
    channel,
    filters,
    emit: (event: "INSERT" | "UPDATE", row: unknown) =>
      handlers[event]?.({ new: row }),
    status: (state: string) => statusCallback?.(state),
  };
}

function events() {
  return { onInsert: vi.fn(), onUpdate: vi.fn(), onStatus: vi.fn() };
}

describe("subscribeToMessages (Android ChatRealtimeService)", () => {
  it("subscribes to inserts and updates of one match on the Android channel name", () => {
    const realtime = fakeRealtime();
    subscribeToMessages(realtime.client, "m1", events());
    expect(realtime.client.channel).toHaveBeenCalledWith("klepet-m1");
    expect(realtime.filters).toEqual([
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: "match_id=eq.m1",
      },
      {
        event: "UPDATE",
        schema: "public",
        table: "messages",
        filter: "match_id=eq.m1",
      },
    ]);
  });

  it("delivers valid inserts and ignores malformed ones", () => {
    const realtime = fakeRealtime();
    const handlers = events();
    subscribeToMessages(realtime.client, "m1", handlers);
    realtime.emit("INSERT", message("a", "2026-10-11T20:00:00Z"));
    realtime.emit("INSERT", {
      ...message("b", "2026-10-11T20:01:00Z"),
      body: "",
    });
    realtime.emit("INSERT", null);
    expect(handlers.onInsert).toHaveBeenCalledTimes(1);
    expect(handlers.onInsert.mock.calls[0][0]).toMatchObject({ id: "a" });
  });

  it("forwards delivery-state updates and ignores invalid ones", () => {
    const realtime = fakeRealtime();
    const handlers = events();
    subscribeToMessages(realtime.client, "m1", handlers);
    realtime.emit("UPDATE", { id: "a", delivery_status: "read" });
    realtime.emit("UPDATE", { id: "a", delivery_status: "lost" });
    realtime.emit("UPDATE", { delivery_status: "read" });
    expect(handlers.onUpdate).toHaveBeenCalledTimes(1);
    expect(handlers.onUpdate).toHaveBeenCalledWith({
      id: "a",
      delivery_status: "read",
    });
  });

  it("reports connection status", () => {
    const realtime = fakeRealtime();
    const handlers = events();
    subscribeToMessages(realtime.client, "m1", handlers);
    realtime.status("SUBSCRIBED");
    realtime.status("CHANNEL_ERROR");
    expect(handlers.onStatus.mock.calls.map(([s]) => s)).toEqual([
      "connecting",
      "live",
      "disconnected",
    ]);
  });

  it("cleans up once and ignores events after cleanup", () => {
    const realtime = fakeRealtime();
    const handlers = events();
    const stop = subscribeToMessages(realtime.client, "m1", handlers);
    stop();
    stop();
    expect(realtime.client.removeChannel).toHaveBeenCalledTimes(1);
    expect(realtime.client.removeChannel).toHaveBeenCalledWith(
      realtime.channel,
    );
    realtime.emit("INSERT", message("a", "2026-10-11T20:00:00Z"));
    realtime.status("SUBSCRIBED");
    expect(handlers.onInsert).not.toHaveBeenCalled();
    expect(handlers.onStatus).toHaveBeenCalledTimes(1);
  });
});

describe("toRealtimeStatus and channelName", () => {
  it.each([
    ["SUBSCRIBED", "live"],
    ["CHANNEL_ERROR", "disconnected"],
    ["TIMED_OUT", "disconnected"],
    ["CLOSED", "disconnected"],
    ["JOINING", "connecting"],
  ])("%s → %s", (state, status) => {
    expect(toRealtimeStatus(state)).toBe(status);
  });

  it("uses the Android channel name", () => {
    expect(channelName("abc")).toBe("klepet-abc");
  });
});

describe("applyRealtimeInsert", () => {
  const history = {
    myUserId: "me",
    messages: [message("a", "2026-10-11T20:00:00Z")],
  };

  it("appends a new message", () => {
    expect(
      applyRealtimeInsert(
        history,
        message("b", "2026-10-11T20:01:00Z"),
      )?.messages.map((m) => m.id),
    ).toEqual(["a", "b"]);
  });

  it("never adds the same id twice (Android dedupe)", () => {
    expect(
      applyRealtimeInsert(history, message("a", "2026-10-11T20:00:00Z")),
    ).toBe(history);
  });

  it("keeps time order when an event arrives late", () => {
    const later = {
      myUserId: "me",
      messages: [
        message("a", "2026-10-11T20:00:00Z"),
        message("c", "2026-10-11T20:02:00Z"),
      ],
    };
    expect(
      applyRealtimeInsert(
        later,
        message("b", "2026-10-11T20:01:00Z"),
      )?.messages.map((m) => m.id),
    ).toEqual(["a", "b", "c"]);
  });

  it("leaves an unloaded history alone", () => {
    expect(applyRealtimeInsert(undefined, message("a", "x"))).toBeUndefined();
  });
});

describe("applyRealtimeUpdate", () => {
  const history = {
    myUserId: "me",
    messages: [
      message("a", "2026-10-11T20:00:00Z", {
        sender_id: "me",
        delivery_status: "delivered",
      }),
      message("b", "2026-10-11T20:01:00Z"),
    ],
  };

  it("moves a message's delivery state forward", () => {
    expect(
      applyRealtimeUpdate(history, { id: "a", delivery_status: "read" })
        ?.messages[0].delivery_status,
    ).toBe("read");
  });

  it("never moves it backwards and ignores unknown ids", () => {
    expect(
      applyRealtimeUpdate(history, { id: "a", delivery_status: "sent" }),
    ).toBe(history);
    expect(
      applyRealtimeUpdate(history, { id: "zzz", delivery_status: "read" }),
    ).toBe(history);
    expect(
      applyRealtimeUpdate(undefined, { id: "a", delivery_status: "read" }),
    ).toBeUndefined();
  });
});
