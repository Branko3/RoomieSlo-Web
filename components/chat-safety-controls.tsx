"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
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

/** "Prijavi" and "Blokiraj"/"Odblokiraj" for the other person in a conversation. */
export function ChatSafetyControls({
  peerId,
  matchId,
  state,
  canBlock = true,
}: {
  peerId: string;
  matchId: string;
  state: ReturnType<typeof useBlockState>;
  /** False for a deleted account: there is nobody left to block, but reporting stays. */
  canBlock?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="chat-safety">
      <div className="chat-safety-actions">
        <Link className="text-link" href={reportHref(peerId, matchId)}>
          Prijavi
        </Link>
        {!canBlock ? null : state.blocked ? (
          <button
            type="button"
            className="text-link"
            disabled={state.pending}
            onClick={() => state.setBlocked(false)}
          >
            Odblokiraj
          </button>
        ) : (
          <button
            type="button"
            className="text-link danger-link"
            disabled={state.pending || state.loading}
            onClick={() => setConfirming(true)}
            aria-expanded={confirming}
          >
            Blokiraj
          </button>
        )}
      </div>
      {canBlock && confirming && !state.blocked && (
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
    </div>
  );
}
