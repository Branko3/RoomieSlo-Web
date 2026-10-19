"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import {
  blockCopy,
  BlockError,
  blockUser,
  hasBlocked,
  reportHref,
  unblockUser,
  type BlockClient,
} from "../lib/chat/blocking";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";
import { FlagIcon, MoreIcon } from "./icons";

function client() {
  return createSupabaseBrowserClient() as unknown as BlockClient;
}

/** Whether I blocked this person, with block/unblock actions. */
export function useBlockState(peerId: string | null) {
  const queryClient = useQueryClient();
  const key = ["block", peerId] as const;
  const query = useQuery({
    queryKey: key,
    enabled: Boolean(peerId),
    queryFn: () => hasBlocked(client(), peerId as string),
  });
  const mutation = useMutation({
    mutationFn: (block: boolean) =>
      block
        ? blockUser(client(), peerId as string)
        : unblockUser(client(), peerId as string),
    onSuccess: (_result, block) => queryClient.setQueryData(key, block),
  });
  return {
    blocked: query.data === true,
    loading: query.isPending,
    setBlocked: mutation.mutate,
    pending: mutation.isPending,
    error:
      mutation.error instanceof BlockError
        ? mutation.error.message
        : mutation.error
          ? blockCopy.failed
          : null,
  };
}

type BlockState = ReturnType<typeof useBlockState>;

/**
 * The "⋯" safety menu in the conversation header. Its items are composed by
 * the page: reporting is always there, blocking only while the other account
 * exists.
 */
export function ChatSafetyMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    // A press anywhere outside the menu closes it, like any other popover.
    // touchstart too: iOS Safari fires no mousedown for taps on plain text,
    // and pointer events are missing from Safari 12 (browserslist).
    const onPointer = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer, { passive: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
    };
  }, [open]);

  return (
    <div className="chat-safety" ref={rootRef}>
      <button
        ref={toggleRef}
        type="button"
        className="icon-button"
        aria-label="Varnost: prijavi ali blokiraj"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <MoreIcon />
      </button>
      <div id={panelId} className="safety-panel" hidden={!open}>
        {children}
      </div>
    </div>
  );
}

/** "Prijavi": report this person, with the conversation attached. */
export function ReportPersonLink({
  peerId,
  matchId,
}: {
  peerId: string;
  matchId: string;
}) {
  return (
    <Link className="safety-item" href={reportHref(peerId, matchId)}>
      <FlagIcon size={18} />
      Prijavi
    </Link>
  );
}

/** "Blokiraj" (with confirmation) or "Odblokiraj". */
export function BlockPersonControl({ state }: { state: BlockState }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      {state.blocked ? (
        <button
          type="button"
          className="safety-item"
          disabled={state.pending}
          onClick={() => state.setBlocked(false)}
        >
          Odblokiraj
        </button>
      ) : (
        <button
          type="button"
          className="safety-item danger-link"
          disabled={state.pending || state.loading}
          onClick={() => setConfirming(true)}
          aria-expanded={confirming}
        >
          Blokiraj
        </button>
      )}
      {confirming && !state.blocked && (
        <div
          className="confirm-panel"
          role="alertdialog"
          aria-labelledby="block-title"
        >
          <p id="block-title">{blockCopy.confirm}</p>
          <div className="confirm-actions">
            <button
              type="button"
              className="button button-outline"
              onClick={() => setConfirming(false)}
            >
              Prekliči
            </button>
            <button
              type="button"
              className="button button-danger"
              disabled={state.pending}
              onClick={() => {
                state.setBlocked(true);
                setConfirming(false);
              }}
            >
              Blokiraj
            </button>
          </div>
        </div>
      )}
      {state.error && (
        <p className="error-message" role="alert">
          {state.error}
        </p>
      )}
    </>
  );
}
