"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
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
  const query = useQuery({
    queryKey: messagesQueryKey(matchId),
    queryFn: () =>
      loadMessages(
        createSupabaseBrowserClient() as unknown as MessagesClient,
        matchId,
      ),
  });
  const endRef = useRef<HTMLDivElement>(null);
  const count = query.data?.messages.length ?? 0;

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

  const { messages, myUserId } = query.data;
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
                    <time dateTime={message.sent_at}>
                      {messageTime(message.sent_at)}
                    </time>
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
