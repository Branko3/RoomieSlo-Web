"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  awaitingMyAnswer,
  cohabitationCopy,
  loadMyCohabitations,
} from "../lib/cohabitation/cohabitation";
import {
  markAcceptedDelivered,
  type DeliveryClient,
} from "../lib/chat/delivery";
import { getSupabaseConfig } from "../lib/config";
import {
  acceptMatchAtomically,
  applyDecision,
  rejectMatchWithConflictCheck,
  type MatchAcceptanceClient,
} from "../lib/matching/match-acceptance";
import {
  loadMyMatches,
  matchMessages,
  MatchRequestError,
  matchStatusLabel,
  type Decision,
  type MatchClient,
  type MatchRow,
} from "../lib/matching/match-requests";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";
import {
  cohabitationClient,
  MY_COHABITATIONS_KEY,
} from "./cohabitation-queries";

const MATCHES_KEY = ["matches", "mine"] as const;

function client() {
  return createSupabaseBrowserClient() as unknown as MatchClient;
}

function acceptanceClient() {
  return createSupabaseBrowserClient() as unknown as MatchAcceptanceClient;
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}

/** Match requests and their states (Android chat list, F15). */
export function MatchRequestsPanel() {
  const configured = getSupabaseConfig().configured;
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: MATCHES_KEY,
    enabled: configured,
    queryFn: async () => {
      const rows = await loadMyMatches(client());
      // Opening the list means the other person's messages reached this device
      // (Android ChatListViewModel). A failure must not break the list.
      void markAcceptedDelivered(
        createSupabaseBrowserClient() as unknown as DeliveryClient,
        rows,
      );
      return rows;
    },
  });
  // Declarations awaiting my answer mark their chat; a failure here only
  // hides the mark, the list itself keeps working.
  const cohabitations = useQuery({
    queryKey: MY_COHABITATIONS_KEY,
    enabled: configured,
    queryFn: () => loadMyCohabitations(cohabitationClient()),
  });
  const awaiting = cohabitations.data
    ? awaitingMyAnswer(cohabitations.data.cohabitations, cohabitations.data.me)
    : new Set<string>();
  const respond = useMutation({
    mutationFn: async ({
      matchId,
      decision,
    }: {
      matchId: string;
      decision: Decision;
    }) => {
      if (decision === "accepted") {
        const accepted = await acceptMatchAtomically(
          acceptanceClient(),
          matchId,
        );
        return { matchId, status: accepted.status, version: accepted.version };
      }
      await rejectMatchWithConflictCheck(acceptanceClient(), matchId);
      return { matchId, status: "rejected" as const, version: undefined };
    },
    // Show the confirmed state at once; the refetch below reconciles the rest.
    onSuccess: ({ matchId, status, version }) =>
      queryClient.setQueryData<MatchRow[]>(MATCHES_KEY, (rows) =>
        rows ? applyDecision(rows, matchId, status, version) : rows,
      ),
    // Refresh after success and after a conflict, so the row shows the real state.
    onSettled: () => queryClient.invalidateQueries({ queryKey: MATCHES_KEY }),
  });

  if (!configured) return null;

  let content: React.ReactNode;
  if (query.isPending) {
    content = <p role="status">Nalaganje zahtev …</p>;
  } else if (query.isError) {
    const error = query.error;
    const signedOut =
      error instanceof MatchRequestError && error.kind === "signed-out";
    content = (
      <div className="page-state" role="alert">
        <p>
          {error instanceof MatchRequestError
            ? error.message
            : matchMessages.load}
        </p>
        {signedOut ? (
          <Link className="button" href="/login">
            Prijava
          </Link>
        ) : (
          <button
            className="button"
            type="button"
            onClick={() => query.refetch()}
          >
            Poskusi znova
          </button>
        )}
      </div>
    );
  } else if (query.data.length === 0) {
    content = (
      <p className="muted">
        Še nimaš zahtev za ujemanje. Pošlji jo iz oglasa ali med priporočenimi
        profili.
      </p>
    );
  } else {
    content = (
      <ul className="match-request-list">
        {query.data.map((row) => {
          const label = matchStatusLabel(row);
          const busy =
            respond.isPending && respond.variables?.matchId === row.match.id;
          return (
            <li
              key={row.match.id}
              className={`match-request match-${row.match.status}`}
            >
              <span className="avatar avatar-small" aria-hidden="true">
                {initials(row.peerName)}
              </span>
              <span className="match-request-text">
                <b>{row.peerName}</b>
                <small>{label}</small>
                {row.match.status === "accepted" &&
                  awaiting.has(row.match.id) && (
                    <span className="attention-mark">
                      <span className="attention-dot" aria-hidden="true" />
                      {cohabitationCopy.attention}
                    </span>
                  )}
              </span>
              {row.match.status === "accepted" && (
                <Link
                  className="text-link"
                  href={`/chats/${encodeURIComponent(row.match.id)}`}
                >
                  Odpri klepet
                </Link>
              )}
              {row.iAmRecipient && (
                <span className="match-request-actions">
                  <button
                    className="button"
                    type="button"
                    disabled={respond.isPending}
                    aria-busy={busy || undefined}
                    onClick={() =>
                      respond.mutate({
                        matchId: row.match.id,
                        decision: "accepted",
                      })
                    }
                  >
                    Sprejmi
                  </button>
                  <button
                    className="button button-outline"
                    type="button"
                    disabled={respond.isPending}
                    onClick={() =>
                      respond.mutate({
                        matchId: row.match.id,
                        decision: "rejected",
                      })
                    }
                  >
                    Zavrni
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <section className="match-requests" aria-labelledby="match-requests-title">
      <h2 id="match-requests-title">Zahteve za ujemanje</h2>
      {respond.isError && (
        <p className="error-message" role="alert">
          {respond.error instanceof MatchRequestError
            ? respond.error.message
            : matchMessages.accept}
        </p>
      )}
      {content}
    </section>
  );
}
