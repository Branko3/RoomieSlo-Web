import { mapMessage, type Message } from "../supabase/mappers";
import type { Row } from "../supabase/types";
import type { Formatters } from "../i18n/formatters";

type DbError = { code?: string; message?: string; status?: number } | null;

/** Android `MESSAGE_COLUMNS` plus `sent_at`, needed to show when a message was sent. */
export const MESSAGE_COLUMNS =
  "id,match_id,sender_id,body,delivery_status,sent_at";

/** Structural subset of the Supabase client used to read a conversation. */
export type MessagesClient = {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string } | null };
      error: DbError;
    }>;
  };
  from: (table: "messages") => {
    select: (columns: string) => {
      eq: (
        column: "match_id",
        value: string,
      ) => {
        order: (
          column: "sent_at",
          options: { ascending: boolean },
        ) => PromiseLike<{ data: Row<"messages">[] | null; error: DbError }>;
      };
    };
  };
};

/** The kind is also the key of its text in `chat.messages.errors`. */
export class MessagesError extends Error {
  constructor(public readonly kind: "signed-out" | "offline" | "failed") {
    super(kind);
    this.name = "MessagesError";
  }
}

/**
 * All messages of a match, oldest first (Android `ChatRepository.getMessages`).
 * RLS (`messages_select`) limits rows to the match's participants. Malformed
 * rows are skipped instead of failing the whole conversation, and duplicate ids
 * are dropped so the list stays stable when Realtime later adds the same rows.
 */
export async function loadMessages(
  client: MessagesClient,
  matchId: string,
): Promise<{ myUserId: string; messages: Message[] }> {
  try {
    const { data: userData } = await client.auth.getUser();
    const myUserId = userData.user?.id;
    if (!myUserId) throw new MessagesError("signed-out");
    const { data, error } = await client
      .from("messages")
      .select(MESSAGE_COLUMNS)
      .eq("match_id", matchId)
      .order("sent_at", { ascending: true });
    if (error) throw error;
    const seen = new Set<string>();
    const messages: Message[] = [];
    for (const row of data ?? []) {
      let message: Message;
      try {
        message = mapMessage(row);
      } catch {
        continue;
      }
      if (seen.has(message.id)) continue;
      seen.add(message.id);
      messages.push(message);
    }
    return { myUserId, messages };
  } catch (error) {
    if (error instanceof MessagesError) throw error;
    const message = (error as { message?: string } | null)?.message ?? "";
    throw new MessagesError(
      error instanceof TypeError || /fetch|network/i.test(message)
        ? "offline"
        : "failed",
    );
  }
}

const TIME_ZONE = "Europe/Ljubljana";
// Internal key, not display text: en-CA formats as YYYY-MM-DD.
const dayKeyFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Calendar day in Ljubljana, `YYYY-MM-DD`. */
export function dayKey(iso: string): string {
  return dayKeyFormat.format(new Date(iso));
}

/** How day headings are written: the catalog's relative words and the locale's formatters. */
export type DayLabelText = {
  today: string;
  yesterday: string;
  formatters: Formatters;
};

/** The catalog's "today" or "yesterday", or the long date for older days. */
export function dayLabel(
  key: string,
  text: DayLabelText,
  now: Date = new Date(),
): string {
  const today = dayKey(now.toISOString());
  const yesterday = dayKey(
    new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
  );
  if (key === today) return text.today;
  if (key === yesterday) return text.yesterday;
  const [year, month, day] = key.split("-").map(Number);
  // Noon UTC is the same calendar day in Ljubljana all year round.
  return text.formatters.dayLabel(Date.UTC(year, month - 1, day, 12));
}

/** "14:05" in Ljubljana time. */
export function messageTime(iso: string, formatters: Formatters): string {
  return formatters.time(iso);
}

export type MessageDay = { key: string; label: string; messages: Message[] };

/** Groups messages (already in time order) by Ljubljana calendar day. */
export function groupByDay(
  messages: readonly Message[],
  text: DayLabelText,
  now: Date = new Date(),
): MessageDay[] {
  const days: MessageDay[] = [];
  for (const message of messages) {
    const key = dayKey(message.sent_at);
    const last = days[days.length - 1];
    if (last && last.key === key) last.messages.push(message);
    else
      days.push({ key, label: dayLabel(key, text, now), messages: [message] });
  }
  return days;
}
