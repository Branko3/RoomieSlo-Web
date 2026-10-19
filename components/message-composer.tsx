"use client";

import { useRef, useState } from "react";
import { MAX_MESSAGE_LENGTH, validateDraft } from "../lib/chat/send-message";
import { SendIcon } from "./icons";

/**
 * Message input for an accepted conversation. Enter sends, Shift+Enter adds a
 * line break. Sending is handed to `onSend`, which shows the message in the
 * conversation immediately; the draft is cleared at once (Android), and a
 * failed message stays in the conversation with retry, so nothing is lost.
 */
export function MessageComposer({
  onSend,
  error,
}: {
  onSend: (body: string) => void;
  error: string | null;
}) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const validation = validateDraft(draft);
  const tooLong = !validation.ok && validation.reason === "too-long";

  function submit() {
    if (!validation.ok) return;
    setDraft("");
    onSend(validation.body);
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
      {error && (
        <p className="error-message" role="alert">
          {error}
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
          className="button composer-send"
          type="submit"
          disabled={!validation.ok}
        >
          <SendIcon size={18} />
          Pošlji
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
