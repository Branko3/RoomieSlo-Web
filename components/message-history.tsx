"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import {
  applyReadLocally,
  deliveryLabel,
  markRead,
  needsReadMarker,
  type DeliveryClient,
} from "../lib/chat/delivery";
import { mergeServerHistory } from "../lib/chat/dedupe";
import type { ChatHistory } from "../lib/chat/local-messages";
import {
  groupByDay,
  loadMessages,
  messageTime,
  MessagesError,
  type MessagesClient,
} from "../lib/chat/messages";
import { isLocal } from "../lib/chat/local-messages";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";

export const messagesQueryKey = (matchId: string) =>
  ["messages", matchId] as const;

/** Message history of an accepted match, oldest first, grouped by day. */
export function MessageHistory({
  matchId,
  peerName,
  onRetry = () => undefined,
  onDiscard = () => undefined,
}: {
  matchId: string;
  peerName: string;
  onRetry?: (localId: string) => void;
  onDiscard?: (localId: string) => void;
}) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: messagesQueryKey(matchId),
    // A refetch (reconnect, focus) keeps local messages that are still
    // sending or failed and drops those the server already has.
    queryFn: async () =>
      mergeServerHistory(
        queryClient.getQueryData<ChatHistory>(messagesQueryKey(matchId)),
        await loadMessages(
          createSupabaseBrowserClient() as unknown as MessagesClient,
          matchId,
        ),
      ),
    // Coming back to the tab refreshes the delivery state of my messages.
    refetchOnWindowFocus: true,
  });
  const endRef = useRef<HTMLDivElement>(null);
  const count = query.data?.messages.length ?? 0;
  const myUserId = query.data?.myUserId;
  const unread =
    query.data && myUserId
      ? needsReadMarker(query.data.messages, myUserId)
      : false;

  // The conversation is open, so the other person's messages are read (Android markRead).
  useEffect(() => {
    if (!unread || !myUserId) return;
    void markRead(
      createSupabaseBrowserClient() as unknown as DeliveryClient,
      matchId,
    ).then((ok) => {
      if (ok) {
        queryClient.setQueryData<ChatHistory>(
          messagesQueryKey(matchId),
          (history) => applyReadLocally(history, myUserId),
        );
      }
    });
  }, [unread, myUserId, matchId, queryClient]);

  // Keep the newest message in view, like a chat app.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [count]);

  if (query.isPending) {
    return (
      <p className="message-state" role="status">
        Nalaganje sporočil …
      </p>
    );
  }
  if (query.isError) {
    return (
      <div className="message-state" role="alert">
        <p>
          {query.error instanceof MessagesError
            ? query.error.message
            : "Napaka pri nalaganju sporočil."}
        </p>
        <button
          className="button button-outline"
          type="button"
          onClick={() => query.refetch()}
        >
          Poskusi znova
        </button>
      </div>
    );
  }

  const { messages } = query.data;
  if (messages.length === 0) {
    return (
      <p className="message-state">
        Še ni sporočil. Pozdravi osebo {peerName}.
      </p>
    );
  }

  return (
    <div
      className="message-log"
      role="log"
      aria-live="polite"
      aria-label={`Sporočila z osebo ${peerName}`}
    >
      {groupByDay(messages).map((day) => (
        <section key={day.key} aria-label={day.label}>
          <p className="message-day">{day.label}</p>
          <ul>
            {day.messages.map((message) => {
              const local = isLocal(message) ? message : null;
              // Local messages are always mine, even before the user id is known.
              const mine = local !== null || message.sender_id === myUserId;
              return (
                <li
                  key={local ? local.localId : message.id}
                  className={`message ${mine ? "message-mine" : "message-theirs"}${
                    local ? ` message-${local.localState}` : ""
                  }`}
                >
                  <span className="sr-only">{mine ? "Ti" : peerName}: </span>
                  <span className="message-body">{message.body}</span>
                  {local?.localState === "sending" && (
                    <small className="message-status">Pošiljanje …</small>
                  )}
                  {local?.localState === "failed" && (
                    <span className="message-failed-actions">
                      <small className="message-status">Ni poslano</small>
                      <button
                        type="button"
                        className="text-link"
                        onClick={() => onRetry(local.localId)}
                      >
                        Poskusi znova
                      </button>
                      <button
                        type="button"
                        className="text-link"
                        onClick={() => onDiscard(local.localId)}
                      >
                        Zavrzi
                      </button>
                    </span>
                  )}
                  {!local && (
                    <span className="message-meta">
                      <time dateTime={message.sent_at}>
                        {messageTime(message.sent_at)}
                      </time>
                      {mine && (
                        <span
                          className={`message-delivery delivery-${message.delivery_status}`}
                        >
                          {" · "}
                          {deliveryLabel(message.delivery_status)}
                        </span>
                      )}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <div ref={endRef} />
    </div>
  );
}
