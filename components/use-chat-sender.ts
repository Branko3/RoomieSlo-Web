"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { dropLocal, newMessageId, upsertStored } from "../lib/chat/dedupe";
import {
  addLocal,
  createLocalMessage,
  failLocal,
  findLocal,
  removeLocal,
  retryLocal,
  type ChatHistory,
  type LocalMessage,
} from "../lib/chat/local-messages";
import {
  sendMessage,
  sendMessageCopy,
  SendMessageError,
  type SendMessageClient,
} from "../lib/chat/send-message";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";
import { messagesQueryKey } from "./message-history";

/**
 * Sends messages with immediate local insertion: the message appears at once
 * as "sending", is replaced by the stored copy when the server confirms it, and
 * stays visible as "failed" (with retry and discard) when sending fails.
 * Several messages can be in flight; each is tracked by its local id.
 */
export function useChatSender(matchId: string) {
  const queryClient = useQueryClient();
  const key = messagesQueryKey(matchId);
  const [error, setError] = useState<string | null>(null);

  const update = useCallback(
    (change: (history: ChatHistory | undefined) => ChatHistory | undefined) =>
      queryClient.setQueryData<ChatHistory>(key, change),
    [queryClient, key],
  );

  const deliver = useCallback(
    async (local: LocalMessage) => {
      try {
        const stored = await sendMessage(
          createSupabaseBrowserClient() as unknown as SendMessageClient,
          matchId,
          local.body,
          local.id,
        );
        if (queryClient.getQueryData(key)) {
          // Replaces the local copy by id; a Realtime echo may already have done so.
          update((history) => upsertStored(history, stored));
        } else {
          // History was not loaded yet: load it, including the new message.
          void queryClient.invalidateQueries({ queryKey: key });
        }
        setError(null);
      } catch (failure) {
        if (
          failure instanceof SendMessageError &&
          failure.kind === "already-sent"
        ) {
          // An earlier attempt was stored although its response was lost:
          // roll back the local copy and show the server's version instead.
          update((history) => dropLocal(history, local.id));
          void queryClient.invalidateQueries({ queryKey: key });
          setError(null);
          return;
        }
        update((history) => failLocal(history, local.localId));
        setError(
          failure instanceof SendMessageError
            ? failure.message
            : sendMessageCopy.failed,
        );
      }
    },
    [matchId, queryClient, key, update],
  );

  const send = useCallback(
    (body: string) => {
      const history = queryClient.getQueryData<ChatHistory>(key);
      // The final id is chosen here, so every copy of this message shares it.
      const local = createLocalMessage(
        matchId,
        history?.myUserId ?? "",
        body,
        new Date(),
        newMessageId(),
      );
      update((current) => addLocal(current, local));
      void deliver(local);
    },
    [deliver, matchId, queryClient, key, update],
  );

  const retry = useCallback(
    (localId: string) => {
      const local = findLocal(
        queryClient.getQueryData<ChatHistory>(key),
        localId,
      );
      if (!local || local.localState !== "failed") return;
      update((history) => retryLocal(history, localId));
      void deliver(local);
    },
    [deliver, queryClient, key, update],
  );

  const discard = useCallback(
    (localId: string) => update((history) => removeLocal(history, localId)),
    [update],
  );

  return { send, retry, discard, error, clearError: () => setError(null) };
}
