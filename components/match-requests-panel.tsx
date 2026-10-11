"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { getSupabaseConfig } from "../lib/config";
import {
  loadMyMatches,
  matchMessages,
  MatchRequestError,
  matchStatusLabel,
  respondToMatch,
  type Decision,
  type MatchClient,
} from "../lib/matching/match-requests";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";

const MATCHES_KEY = ["matches", "mine"] as const;

function client() {
  return createSupabaseBrowserClient() as unknown as MatchClient;
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
    queryFn: () => loadMyMatches(client()),
  });
  const respond = useMutation({
    mutationFn: ({
      matchId,
      decision,
    }: {
      matchId: string;
      decision: Decision;
    }) => respondToMatch(client(), matchId, decision),
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
