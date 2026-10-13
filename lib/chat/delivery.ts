import type { MessageDeliveryStatus } from "../supabase/types";

type DbError = { code?: string; message?: string; status?: number } | null;

/** Android `besediloStanja`: shown under the sender's own messages only. */
export function deliveryLabel(status: MessageDeliveryStatus): string {
  switch (status) {
    case "sent":
      return "Poslano";
    case "delivered":
      return "Dostavljeno";
    case "read":
      return "Prebrano";
  }
}

const RANK: Record<MessageDeliveryStatus, number> = {
  sent: 0,
  delivered: 1,
  read: 2,
};

/** Delivery state only moves forward (sent → delivered → read), never back. */
export function isAdvance(
  from: MessageDeliveryStatus,
  to: MessageDeliveryStatus,
): boolean {
  return RANK[to] > RANK[from];
}

type UpdateFilter = PromiseLike<{ error: DbError }> & {
  eq: (column: string, value: string) => UpdateFilter;
  neq: (column: string, value: string) => UpdateFilter;
};

/** Structural subset of the Supabase client used to update delivery state. */
export type DeliveryClient = {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string } | null };
      error: DbError;
    }>;
  };
  from: (table: "messages") => {
    update: (values: {
      delivery_status: MessageDeliveryStatus;
    }) => UpdateFilter;
  };
};

async function currentUser(client: DeliveryClient): Promise<string | null> {
  const { data } = await client.auth.getUser();
  return data.user?.id ?? null;
}

/**
 * Marks the other person's messages in a match as read (Android `markRead`),
 * called when the conversation is open. Only their messages are touched and
 * only rows that are not read yet, so the state never moves backwards. Errors
 * are swallowed: the chat must work even if the marker fails (Android).
 */
export async function markRead(
  client: DeliveryClient,
  matchId: string,
): Promise<boolean> {
  try {
    const me = await currentUser(client);
    if (!me) return false;
    const { error } = await client
      .from("messages")
      .update({ delivery_status: "read" })
      .eq("match_id", matchId)
      .neq("sender_id", me)
      .neq("delivery_status", "read");
    return !error;
  } catch {
    return false;
  }
}

/**
 * Marks the other person's `sent` messages as delivered (Android
 * `markDelivered`), used when the user opens the app's chat list: the messages
 * reached the device even if that conversation was not opened.
 */
export async function markDelivered(
  client: DeliveryClient,
  matchId: string,
): Promise<boolean> {
  try {
    const me = await currentUser(client);
    if (!me) return false;
    const { error } = await client
      .from("messages")
      .update({ delivery_status: "delivered" })
      .eq("match_id", matchId)
      .neq("sender_id", me)
      .eq("delivery_status", "sent");
    return !error;
  } catch {
    return false;
  }
}

/**
 * Marks the other person's messages delivered in every accepted match, as
 * Android's chat list does on each load: opening the list means the messages
 * reached this device. Never throws; returns how many matches were updated.
 */
export async function markAcceptedDelivered(
  client: DeliveryClient,
  rows: ReadonlyArray<{ match: { id: string; status: string } }>,
): Promise<number> {
  const results = await Promise.all(
    rows
      .filter((row) => row.match.status === "accepted")
      .map((row) => markDelivered(client, row.match.id)),
  );
  return results.filter(Boolean).length;
}

/** Marks the other person's messages as read in the loaded history, so it matches the server. */
export function applyReadLocally<
  T extends {
    messages: Array<{
      sender_id: string;
      delivery_status: MessageDeliveryStatus;
    }>;
  },
>(history: T | undefined, myUserId: string): T | undefined {
  if (!history) return history;
  let changed = false;
  const messages = history.messages.map((message) => {
    if (message.sender_id === myUserId || message.delivery_status === "read")
      return message;
    changed = true;
    return { ...message, delivery_status: "read" as const };
  });
  return changed ? { ...history, messages } : history;
}

/** Whether a newly arrived message from the other person should trigger a read marker. */
export function needsReadMarker(
  messages: ReadonlyArray<{
    sender_id: string;
    delivery_status: MessageDeliveryStatus;
  }>,
  myUserId: string,
): boolean {
  return messages.some(
    (m) => m.sender_id !== myUserId && m.delivery_status !== "read",
  );
}
