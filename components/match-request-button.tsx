"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { getSupabaseConfig } from "../lib/config";
import {
  existingRequestMessage,
  loadRequestState,
  sendMatchRequest,
  sendRequestMessages,
  SendRequestError,
  type RequestState,
  type SendRequestClient,
} from "../lib/matching/send-request";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";

function client() {
  return createSupabaseBrowserClient() as unknown as SendRequestClient;
}

/**
 * "Pošlji zahtevo za ujemanje" for a listing owner. Shows an existing request
 * instead of the button, so the same pair can never be asked twice.
 */
export function MatchRequestButton({
  ownerId,
  disabled = false,
}: {
  ownerId: string;
  disabled?: boolean;
}) {
  const configured = getSupabaseConfig().configured;
  const queryClient = useQueryClient();
  const key = ["match-request", ownerId] as const;
  const state = useQuery({
    queryKey: key,
    enabled: configured,
    queryFn: () => loadRequestState(client(), ownerId),
  });
  const send = useMutation({
    mutationFn: () => sendMatchRequest(client(), ownerId),
    onSuccess: ({ request }) => {
      const next: RequestState = { kind: "exists", request };
      queryClient.setQueryData(key, next);
      void queryClient.invalidateQueries({ queryKey: ["matches"] });
    },
  });

  if (!configured) {
    return (
      <p className="field-hint">Pošiljanje zahtev trenutno ni na voljo.</p>
    );
  }
  if (state.isPending) {
    return (
      <button className="button full-button" type="button" disabled>
        Pošlji zahtevo za ujemanje
      </button>
    );
  }
  if (state.isError) {
    return (
      <p className="error-message" role="alert">
        {state.error instanceof SendRequestError
          ? state.error.message
          : sendRequestMessages.failed}{" "}
        <button
          className="text-link"
          type="button"
          onClick={() => state.refetch()}
        >
          Poskusi znova
        </button>
      </p>
    );
  }

  const current = state.data;
  if (current.kind === "own-listing") {
    return <p className="field-hint">To je tvoj oglas.</p>;
  }
  if (current.kind === "signed-out") {
    return (
      <Link className="button full-button" href="/login">
        Prijavi se za pošiljanje zahteve
      </Link>
    );
  }
  if (current.kind === "exists") {
    const justSent = send.isSuccess && send.data.created;
    return (
      <div
        className="success-message full-button"
        role="status"
        aria-live="polite"
      >
        {justSent
          ? "Zahteva je poslana."
          : existingRequestMessage(current.request)}{" "}
        <Link href="/chats">Odpri klepete →</Link>
      </div>
    );
  }

  return (
    <>
      <button
        className="button full-button"
        type="button"
        onClick={() => send.mutate()}
        disabled={disabled || send.isPending}
        aria-busy={send.isPending || undefined}
      >
        {send.isPending ? "Pošiljanje …" : "Pošlji zahtevo za ujemanje"}
      </button>
      {send.isError && (
        <p className="error-message" role="alert">
          {send.error instanceof SendRequestError
            ? send.error.message
            : sendRequestMessages.failed}
        </p>
      )}
    </>
  );
}
