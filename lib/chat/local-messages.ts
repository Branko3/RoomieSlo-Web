import type { Message } from "../supabase/mappers";

/** A message shown before (or instead of) its server copy. */
export type LocalMessage = Message & {
  localId: string;
  localState: "sending" | "failed";
};

export type ChatEntry = Message | LocalMessage;

export type ChatHistory = { myUserId: string; messages: ChatEntry[] };

export function isLocal(entry: ChatEntry): entry is LocalMessage {
  return "localId" in entry;
}

let counter = 0;

/** Client-only id, never sent to the server. */
export function newLocalId(): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${(counter += 1)}`;
  return `local-${random}`;
}

/** Builds the message shown immediately after pressing send. */
export function createLocalMessage(
  matchId: string,
  senderId: string,
  body: string,
  now: Date = new Date(),
  localId: string = newLocalId(),
): LocalMessage {
  return {
    id: localId,
    localId,
    localState: "sending",
    match_id: matchId,
    sender_id: senderId,
    body,
    delivery_status: "sent",
    sent_at: now.toISOString(),
  };
}

/** Adds a local message at the end of the conversation. */
export function addLocal(
  history: ChatHistory | undefined,
  local: LocalMessage,
) {
  if (!history) return history;
  return { ...history, messages: [...history.messages, local] };
}

/**
 * Replaces the local message with the stored copy. If the stored message is
 * already present (for example delivered by Realtime first), the local copy is
 * simply removed, so the message is never shown twice.
 */
export function confirmLocal(
  history: ChatHistory | undefined,
  localId: string,
  stored: Message,
) {
  if (!history) return history;
  const alreadyThere = history.messages.some(
    (entry) => !isLocal(entry) && entry.id === stored.id,
  );
  return {
    ...history,
    messages: alreadyThere
      ? history.messages.filter(
          (entry) => !(isLocal(entry) && entry.localId === localId),
        )
      : history.messages.map((entry) =>
          isLocal(entry) && entry.localId === localId ? stored : entry,
        ),
  };
}

function setState(
  history: ChatHistory | undefined,
  localId: string,
  localState: LocalMessage["localState"],
) {
  if (!history) return history;
  return {
    ...history,
    messages: history.messages.map((entry) =>
      isLocal(entry) && entry.localId === localId
        ? { ...entry, localState }
        : entry,
    ),
  };
}

/** Marks a local message as not sent; it stays visible with retry/discard. */
export function failLocal(history: ChatHistory | undefined, localId: string) {
  return setState(history, localId, "failed");
}

/** Marks a failed local message as sending again (retry). */
export function retryLocal(history: ChatHistory | undefined, localId: string) {
  return setState(history, localId, "sending");
}

/** Removes a local message (discard). */
export function removeLocal(history: ChatHistory | undefined, localId: string) {
  if (!history) return history;
  return {
    ...history,
    messages: history.messages.filter(
      (entry) => !(isLocal(entry) && entry.localId === localId),
    ),
  };
}

/** Finds a local message, e.g. to resend its body. */
export function findLocal(history: ChatHistory | undefined, localId: string) {
  return history?.messages.find(
    (entry): entry is LocalMessage =>
      isLocal(entry) && entry.localId === localId,
  );
}
