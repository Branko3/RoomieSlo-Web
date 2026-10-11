"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import type { Message } from "../lib/supabase/mappers";
import {
  appendMessage,
  MAX_MESSAGE_LENGTH,
  sendMessage,
  sendMessageCopy,
  SendMessageError,
  validateDraft,
  type SendMessageClient,
} from "../lib/chat/send-message";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";
import { messagesQueryKey } from "./message-history";

/**
 * Message input for an accepted conversation. Enter sends, Shift+Enter adds a
 * line break. The draft is cleared when sending starts (Android) and restored
 * if sending fails, so a failed message is never lost.
 */
export function MessageComposer({ matchId }: { matchId: string }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const send = useMutation({
    mutationFn: (body: string) =>
      sendMessage(
        createSupabaseBrowserClient() as unknown as SendMessageClient,
        matchId,
        body,
      ),
    onSuccess: (message) => {
      queryClient.setQueryData<{ myUserId: string; messages: Message[] }>(
        messagesQueryKey(matchId),
        (history) => appendMessage(history, message),
      );
    },
    onError: (_error, body) => {
      // Give the text back unless the user already started a new one.
      setDraft((current) => (current ? current : body));
    },
  });

  const validation = validateDraft(draft);
  const tooLong = !validation.ok && validation.reason === "too-long";

  function submit() {
    if (!validation.ok || send.isPending) return;
    setDraft("");
    send.mutate(validation.body);
    inputRef.current?.focus();
  }

  return (
    <form
      className="message-composer"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {send.isError && (
        <p className="error-message" role="alert">
          {send.error instanceof SendMessageError
            ? send.error.message
            : sendMessageCopy.failed}
        </p>
      )}
      <div className="composer-row">
        <label className="sr-only" htmlFor="message-input">
          Sporočilo
        </label>
        <textarea
          id="message-input"
          ref={inputRef}
          value={draft}
          rows={1}
          placeholder="Napiši sporočilo …"
          aria-invalid={tooLong || undefined}
          aria-describedby={tooLong ? "message-length" : undefined}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              submit();
            }
          }}
        />
        <button
          className="button"
          type="submit"
          disabled={!validation.ok || send.isPending}
          aria-busy={send.isPending || undefined}
        >
          {send.isPending ? "Pošiljanje …" : "Pošlji"}
        </button>
      </div>
      {draft.length > MAX_MESSAGE_LENGTH * 0.9 && (
        <small
          id="message-length"
          className={`field-hint ${tooLong ? "field-error" : ""}`}
        >
          {draft.trim().length}/{MAX_MESSAGE_LENGTH}
        </small>
      )}
    </form>
  );
}
