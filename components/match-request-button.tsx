"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ChevronRightIcon } from "./icons";
import { getSupabaseConfig } from "../lib/config";
import {
  existingRequestKey,
  loadRequestState,
  sendMatchRequest,
  SendRequestError,
  type RequestState,
  type SendRequestClient,
} from "../lib/matching/send-request";
import {
  ACCEPTANCE_POLL_MS,
  chatLinkFor,
  shouldWatchForAcceptance,
} from "../lib/matching/chat-link";
import { useI18n } from "../lib/i18n/provider";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";

function client() {
  return createSupabaseBrowserClient() as unknown as SendRequestClient;
}

/**
 * "Send a match request" for a listing owner. Shows an existing request
 * instead of the button, so the same pair can never be asked twice.
 */
export function MatchRequestButton({
  ownerId,
  disabled = false,
}: {
  ownerId: string;
  disabled?: boolean;
}) {
  const { m } = useI18n();
  const copy = m.matching.send;
  const configured = getSupabaseConfig().configured;
  const queryClient = useQueryClient();
  const key = ["match-request", ownerId] as const;
  const state = useQuery({
    queryKey: key,
    enabled: configured,
    queryFn: () => loadRequestState(client(), ownerId),
    // While my request waits for an answer, re-check so the chat link appears once accepted.
    refetchInterval: (query) =>
      shouldWatchForAcceptance(query.state.data) ? ACCEPTANCE_POLL_MS : false,
    refetchOnWindowFocus: (query) => shouldWatchForAcceptance(query.state.data),
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
    return <p className="field-hint">{copy.unavailable}</p>;
  }
  if (state.isPending) {
    return (
      <button className="button full-button" type="button" disabled>
        {copy.action}
      </button>
    );
  }
  if (state.isError) {
    return (
      <p className="error-message" role="alert">
        {state.error instanceof SendRequestError
          ? copy.errors[state.error.kind]
          : copy.errors.failed}{" "}
        <button
          className="text-link"
          type="button"
          onClick={() => state.refetch()}
        >
          {m.common.actions.retry}
        </button>
      </p>
    );
  }

  const current = state.data;
  if (current.kind === "own-listing") {
    return <p className="field-hint">{copy.ownListing}</p>;
  }
  if (current.kind === "signed-out") {
    return (
      <Link className="button full-button" href="/login">
        {copy.signIn}
      </Link>
    );
  }
  if (current.kind === "exists") {
    const justSent =
      send.isSuccess &&
      send.data.created &&
      current.request.status === "pending";
    const link = chatLinkFor(current.request);
    return (
      <div
        className="success-message full-button"
        role="status"
        aria-live="polite"
      >
        {justSent
          ? copy.sent
          : copy.existing[existingRequestKey(current.request)]}{" "}
        <Link className="link-chevron" href={link.href}>
          {link.target === "chat" ? copy.openChat : copy.openChats}
          <ChevronRightIcon size={16} />
        </Link>
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
        {send.isPending ? copy.sending : copy.action}
      </button>
      {send.isError && (
        <p className="error-message" role="alert">
          {send.error instanceof SendRequestError
            ? copy.errors[send.error.kind]
            : copy.errors.failed}
        </p>
      )}
    </>
  );
}
