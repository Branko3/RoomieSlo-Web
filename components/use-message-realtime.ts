"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { ChatHistory } from "../lib/chat/local-messages";
import {
  applyRealtimeInsert,
  applyRealtimeUpdate,
  subscribeToMessages,
  type RealtimeClient,
  type RealtimeStatus,
} from "../lib/chat/realtime";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";
import { messagesQueryKey } from "./message-history";

/**
 * Keeps an open conversation live. The channel is removed when the tab is
 * hidden or the page unmounts (no idle WebSockets in background tabs); when
 * the tab becomes visible again it resubscribes and refetches the history, so
 * messages that arrived while hidden are reconciled from the server.
 */
export function useMessageRealtime(matchId: string, enabled: boolean) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<RealtimeStatus>("connecting");

  useEffect(() => {
    if (!enabled) return;
    const client = createSupabaseBrowserClient() as unknown as RealtimeClient;
    const key = messagesQueryKey(matchId);
    let stop: (() => void) | null = null;

    const start = () => {
      if (stop) return;
      stop = subscribeToMessages(client, matchId, {
        onInsert: (message) =>
          queryClient.setQueryData<ChatHistory>(key, (history) =>
            applyRealtimeInsert(history, message),
          ),
        onUpdate: (update) =>
          queryClient.setQueryData<ChatHistory>(key, (history) =>
            applyRealtimeUpdate(history, update),
          ),
        onStatus: setStatus,
      });
    };
    const pause = () => {
      stop?.();
      stop = null;
      setStatus("disconnected");
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        pause();
      } else {
        start();
        void queryClient.invalidateQueries({ queryKey: key });
      }
    };

    if (document.visibilityState !== "hidden") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stop?.();
      stop = null;
    };
  }, [enabled, matchId, queryClient]);

  return status;
}
