import { mapMessage, type Message } from "../supabase/mappers";
import type { Row } from "../supabase/types";
import { MESSAGE_COLUMNS } from "./messages";

type DbError = { code?: string; message?: string; status?: number } | null;

/** Upper bound for one message; keeps the UI and the table sane. */
export const MAX_MESSAGE_LENGTH = 2000;

export type DraftValidation =
  { ok: true; body: string } | { ok: false; reason: "empty" | "too-long" };

/** Android `send()`: the draft is trimmed and an empty message is not sent. */
export function validateDraft(draft: string): DraftValidation {
  const body = draft.trim();
  if (!body) return { ok: false, reason: "empty" };
  if (body.length > MAX_MESSAGE_LENGTH)
    return { ok: false, reason: "too-long" };
  return { ok: true, body };
}

/** Structural subset of the Supabase client used to send a message. */
export type SendMessageClient = {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string } | null };
      error: DbError;
    }>;
  };
  from: (table: "messages") => {
    insert: (row: { match_id: string; sender_id: string; body: string }) => {
      select: (columns: string) => {
        single: () => PromiseLike<{
          data: Row<"messages"> | null;
          error: DbError;
        }>;
      };
    };
  };
};

export const sendMessageCopy = {
  failed: "Sporočila ni bilo mogoče poslati.",
  offline: "Ni povezave. Sporočilo ni bilo poslano.",
  signedOut: "Za pošiljanje sporočil se moraš prijaviti.",
  notAllowed: "V ta pogovor ne moreš pisati.",
  tooLong: `Sporočilo je lahko dolgo največ ${MAX_MESSAGE_LENGTH} znakov.`,
} as const;

export class SendMessageError extends Error {
  constructor(
    public readonly kind:
      "signed-out" | "not-allowed" | "too-long" | "offline" | "failed",
    message: string,
  ) {
    super(message);
    this.name = "SendMessageError";
  }
}

/**
 * Sends a message and returns the stored row (Android `ChatRepository.sendMessage`),
 * so the caller can append it without reloading the conversation. RLS
 * `messages_insert` requires `sender_id = auth.uid()` and participation in the
 * match; a refusal (42501) means the user may not write into this match.
 */
export async function sendMessage(
  client: SendMessageClient,
  matchId: string,
  draft: string,
): Promise<Message> {
  const validation = validateDraft(draft);
  if (!validation.ok) {
    throw validation.reason === "too-long"
      ? new SendMessageError("too-long", sendMessageCopy.tooLong)
      : new SendMessageError("failed", sendMessageCopy.failed);
  }
  try {
    const { data: userData } = await client.auth.getUser();
    const senderId = userData.user?.id;
    if (!senderId)
      throw new SendMessageError("signed-out", sendMessageCopy.signedOut);
    const { data, error } = await client
      .from("messages")
      .insert({ match_id: matchId, sender_id: senderId, body: validation.body })
      .select(MESSAGE_COLUMNS)
      .single();
    if (error) {
      if (error.code === "42501" || error.status === 403) {
        throw new SendMessageError("not-allowed", sendMessageCopy.notAllowed);
      }
      throw error;
    }
    if (!data) throw new SendMessageError("failed", sendMessageCopy.failed);
    return mapMessage(data);
  } catch (error) {
    if (error instanceof SendMessageError) throw error;
    const message = (error as { message?: string } | null)?.message ?? "";
    throw error instanceof TypeError || /fetch|network/i.test(message)
      ? new SendMessageError("offline", sendMessageCopy.offline)
      : new SendMessageError("failed", sendMessageCopy.failed);
  }
}

/** Appends a sent message to the loaded history unless it is already there (Android dedupe by id). */
export function appendMessage<T extends { messages: Message[] }>(
  history: T | undefined,
  message: Message,
): T | undefined {
  if (!history) return history;
  if (history.messages.some((existing) => existing.id === message.id))
    return history;
  return { ...history, messages: [...history.messages, message] };
}
