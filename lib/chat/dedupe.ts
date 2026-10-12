import type { Message } from "../supabase/mappers";
import { isLocal, type ChatEntry, type ChatHistory } from "./local-messages";

/**
 * De-duplication by id. Every message gets its final UUID on the client before
 * it is sent (the insert supplies `id`), so the local copy, the insert
 * response, the Realtime echo, and any refetched copy all share one id. A
 * message can therefore never appear twice, whatever order those arrive in,
 * and identical texts sent in a row stay separate messages.
 */

export function newMessageId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  // RFC 4122 v4 fallback for environments without crypto.randomUUID.
  const bytes = Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 256),
  );
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function byTime(a: ChatEntry, b: ChatEntry): number {
  return a.sent_at < b.sent_at ? -1 : a.sent_at > b.sent_at ? 1 : 0;
}

/**
 * Puts a stored message into the history: it replaces the local copy with the
 * same id (sending or failed), is ignored if the stored copy is already there,
 * and is otherwise inserted in time order. Used for insert responses and for
 * Realtime INSERT events alike, so their order does not matter.
 */
export function upsertStored(
  history: ChatHistory | undefined,
  stored: Message,
) {
  if (!history) return history;
  let replaced = false;
  const messages: ChatEntry[] = [];
  for (const entry of history.messages) {
    if (entry.id !== stored.id) {
      messages.push(entry);
    } else if (isLocal(entry)) {
      if (!replaced) messages.push(stored);
      replaced = true;
    } else {
      // The stored copy is already shown; keep it and drop nothing else.
      return history;
    }
  }
  if (!replaced) {
    messages.push(stored);
    messages.sort(byTime);
  }
  return { ...history, messages };
}

/**
 * Merges a freshly loaded server history with the cache: server messages are
 * the source of truth, local messages still sending or failed are kept, and
 * any local message whose id is now on the server is dropped (it was stored).
 * Used for every refetch, including after a Realtime reconnect.
 */
export function mergeServerHistory(
  previous: ChatHistory | undefined,
  fresh: { myUserId: string; messages: Message[] },
): ChatHistory {
  const serverIds = new Set(fresh.messages.map((message) => message.id));
  const locals = (previous?.messages ?? []).filter(
    (entry) => isLocal(entry) && !serverIds.has(entry.id),
  );
  return {
    myUserId: fresh.myUserId,
    messages: [...fresh.messages, ...locals].sort(byTime),
  };
}

/**
 * Rollback of a send whose outcome is unknown: removes the local copy (the
 * history is returned unchanged if there is none). Used when a retry finds the
 * message already stored (duplicate id), after which the history is refetched.
 */
export function dropLocal(history: ChatHistory | undefined, id: string) {
  if (!history) return history;
  const messages = history.messages.filter(
    (entry) => !(isLocal(entry) && entry.id === id),
  );
  return messages.length === history.messages.length
    ? history
    : { ...history, messages };
}
