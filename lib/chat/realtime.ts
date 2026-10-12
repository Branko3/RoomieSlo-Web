import { mapMessage, type Message } from "../supabase/mappers";
import type { MessageDeliveryStatus, Row } from "../supabase/types";
import { isAdvance } from "./delivery";

export type RealtimeStatus = "connecting" | "live" | "disconnected";

type ChangePayload = { new: Partial<Row<"messages">> | null };

/** Structural subset of a Supabase Realtime channel. */
export type RealtimeChannelLike = {
  on: (
    type: "postgres_changes",
    filter: {
      event: "INSERT" | "UPDATE";
      schema: "public";
      table: "messages";
      filter: string;
    },
    callback: (payload: ChangePayload) => void,
  ) => RealtimeChannelLike;
  subscribe: (
    callback?: (status: string, error?: Error) => void,
  ) => RealtimeChannelLike;
};

/** Structural subset of the Supabase client used for Realtime. */
export type RealtimeClient = {
  channel: (name: string) => RealtimeChannelLike;
  removeChannel: (channel: RealtimeChannelLike) => unknown;
};

export type MessageEvents = {
  onInsert: (message: Message) => void;
  onUpdate: (update: {
    id: string;
    delivery_status: MessageDeliveryStatus;
  }) => void;
  onStatus: (status: RealtimeStatus) => void;
};

/** Android channel name `klepet-<matchId>`. */
export function channelName(matchId: string): string {
  return `klepet-${matchId}`;
}

/** Maps Supabase subscribe states to what the UI needs to know. */
export function toRealtimeStatus(state: string): RealtimeStatus {
  if (state === "SUBSCRIBED") return "live";
  if (
    state === "CHANNEL_ERROR" ||
    state === "TIMED_OUT" ||
    state === "CLOSED"
  ) {
    return "disconnected";
  }
  return "connecting";
}

/**
 * Subscribes to new and updated messages of one match (Android
 * `ChatRealtimeService.observeMessages`, plus UPDATE events so delivery
 * state changes live). RLS still decides which rows are delivered. Malformed
 * payloads are ignored. Returns a cleanup that removes the channel; it is safe
 * to call more than once.
 */
export function subscribeToMessages(
  client: RealtimeClient,
  matchId: string,
  events: MessageEvents,
): () => void {
  const filter = `match_id=eq.${matchId}`;
  let active = true;
  events.onStatus("connecting");
  const channel = client
    .channel(channelName(matchId))
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter },
      (payload) => {
        if (!active || !payload.new) return;
        try {
          events.onInsert(mapMessage(payload.new as Row<"messages">));
        } catch {
          // Ignore malformed events; the next history refetch reconciles.
        }
      },
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "messages", filter },
      (payload) => {
        const row = payload.new;
        if (!active || !row?.id || !row.delivery_status) return;
        if (!["sent", "delivered", "read"].includes(row.delivery_status))
          return;
        events.onUpdate({ id: row.id, delivery_status: row.delivery_status });
      },
    )
    .subscribe((state) => {
      if (active) events.onStatus(toRealtimeStatus(state));
    });

  return () => {
    if (!active) return;
    active = false;
    void client.removeChannel(channel);
  };
}

type History = { myUserId: string; messages: Message[] };

/**
 * Adds a message received through Realtime, keeping the list in time order and
 * never adding the same id twice (Android: `if (messages.none { it.id == novo.id })`).
 */
export function applyRealtimeInsert<T extends History>(
  history: T | undefined,
  message: Message,
): T | undefined {
  if (!history) return history;
  if (history.messages.some((existing) => existing.id === message.id))
    return history;
  const messages = [...history.messages, message];
  // Events normally arrive in order; keep server time order if one is late.
  for (
    let i = messages.length - 1;
    i > 0 && messages[i - 1].sent_at > messages[i].sent_at;
    i -= 1
  ) {
    [messages[i - 1], messages[i]] = [messages[i], messages[i - 1]];
  }
  return { ...history, messages };
}

/** Applies a delivery-state change, only ever moving forward (sent → delivered → read). */
export function applyRealtimeUpdate<T extends History>(
  history: T | undefined,
  update: { id: string; delivery_status: MessageDeliveryStatus },
): T | undefined {
  if (!history) return history;
  let changed = false;
  const messages = history.messages.map((message) => {
    if (
      message.id !== update.id ||
      !isAdvance(message.delivery_status, update.delivery_status)
    ) {
      return message;
    }
    changed = true;
    return { ...message, delivery_status: update.delivery_status };
  });
  return changed ? { ...history, messages } : history;
}
