"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { ChatHistory } from "../lib/chat/local-messages";
import {
  applyRealtimeInsert,
  applyRealtimeUpdate,
  subscribeToMessages,
  type RealtimeClient,
} from "../lib/chat/realtime";
import {
  createReconnectingSubscription,
  type ReconnectState,
} from "../lib/chat/reconnect";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";
import { messagesQueryKey } from "./message-history";

export type LiveState = { state: ReconnectState; retryInMs?: number };

/**
 * Keeps an open conversation live and reconnects with bounded backoff
 * (1, 2, 4, 8, 16, then 30 s, like Android). The channel is removed while the
 * tab is hidden or the page unmounts; becoming visible again or the browser
 * coming back online reconnects at once. Every successful reconnect, and every
 * return to the tab, refetches the history so missed messages are reconciled.
 */
export function useMessageRealtime(
  matchId: string,
  enabled: boolean,
): LiveState {
  const queryClient = useQueryClient();
  const [live, setLive] = useState<LiveState>({ state: "connecting" });

  useEffect(() => {
    if (!enabled) return;
    const client = createSupabaseBrowserClient() as unknown as RealtimeClient;
    const key = messagesQueryKey(matchId);
    const reconcile = () =>
      void queryClient.invalidateQueries({ queryKey: key });

    const subscription = createReconnectingSubscription({
      connect: (onStatus) =>
        subscribeToMessages(client, matchId, {
          onInsert: (message) =>
            queryClient.setQueryData<ChatHistory>(key, (history) =>
              applyRealtimeInsert(history, message),
            ),
          onUpdate: (update) =>
            queryClient.setQueryData<ChatHistory>(key, (history) =>
              applyRealtimeUpdate(history, update),
            ),
          onStatus,
        }),
      onReconnected: reconcile,
      onState: (state, retryInMs) => setLive({ state, retryInMs }),
    });

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        subscription.pause();
      } else {
        subscription.resume();
        reconcile();
      }
    };
    const onOnline = () => subscription.retryNow();

    if (document.visibilityState !== "hidden") subscription.start();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      subscription.pause();
    };
  }, [enabled, matchId, queryClient]);

  return live;
}

/** User-facing notice for the live connection, or null when nothing needs saying. */
export function liveNotice(live: LiveState): string | null {
  if (live.state === "waiting") {
    const seconds = Math.max(1, Math.round((live.retryInMs ?? 0) / 1000));
    return `Povezava v živo je prekinjena. Ponovni poskus čez ${seconds} s.`;
  }
  if (live.state === "disconnected") {
    return "Povezava v živo je prekinjena. Nova sporočila se prikažejo, ko se povezava obnovi.";
  }
  return null;
}
