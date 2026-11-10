"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CohabitationError,
  cohabitationStatus,
  loadFailure,
  loadMyCohabitations,
} from "../lib/cohabitation/cohabitation";
import { monthSpanLabel } from "../lib/cohabitation/months";
import {
  fetchOwnProfile,
  updateAvailability,
  type OwnProfileResult,
  type ProfileClient,
  type ProfileRequestError,
} from "../lib/profile/own-profile";
import { useI18n } from "../lib/i18n/provider";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";
import {
  cohabitationClient,
  MY_COHABITATIONS_KEY,
} from "./cohabitation-queries";
import { OWN_PROFILE_QUERY_KEY } from "./own-profile-section";

/** Cohabitations for which the availability suggestion was already shown (this browser only). */
const SUGGESTED_KEY = "roomieslo.cohabitation.availability-suggested";

function readSuggested(): string[] {
  try {
    const value = JSON.parse(
      window.localStorage.getItem(SUGGESTED_KEY) ?? "[]",
    );
    return Array.isArray(value)
      ? value.filter((v) => typeof v === "string")
      : [];
  } catch {
    return [];
  }
}

function rememberSuggested(ids: string[]) {
  try {
    window.localStorage.setItem(SUGGESTED_KEY, JSON.stringify(ids));
  } catch {
    // Storage unavailable: the suggestion is then hidden for this visit only.
  }
}

/**
 * "Moje sobivanje" on `/profile`: my own cohabitations, visible only to me and
 * the other person. When one becomes active while "Iščem sostanovalca / sobo"
 * is on, it suggests switching that off once; it never does so by itself.
 */
export function MyCohabitationsSection() {
  const i18n = useI18n();
  const t = i18n.m.cohabitation;
  const queryClient = useQueryClient();
  const profileClient = useMemo(
    () => createSupabaseBrowserClient() as unknown as ProfileClient,
    [],
  );
  const query = useQuery({
    queryKey: MY_COHABITATIONS_KEY,
    queryFn: () => loadMyCohabitations(cohabitationClient()),
  });
  const profile = useQuery<OwnProfileResult, ProfileRequestError>({
    queryKey: OWN_PROFILE_QUERY_KEY,
    queryFn: () => fetchOwnProfile(profileClient),
  });
  const [suggested, setSuggested] = useState<string[]>(() =>
    typeof window === "undefined" ? [] : readSuggested(),
  );
  const dismiss = (id: string) => {
    const next = [...new Set([...suggested, id])];
    setSuggested(next);
    rememberSuggested(next);
  };
  const turnOff = useMutation<
    unknown,
    ProfileRequestError,
    { userId: string; cohabitationId: string }
  >({
    mutationFn: ({ userId }) =>
      updateAvailability(profileClient, userId, false),
    onSuccess: (_result, { cohabitationId }) => {
      queryClient.setQueryData<OwnProfileResult>(
        OWN_PROFILE_QUERY_KEY,
        (previous) =>
          previous?.status === "ready"
            ? {
                ...previous,
                profile: { ...previous.profile, is_available: false },
              }
            : previous,
      );
      dismiss(cohabitationId);
    },
  });

  let content: React.ReactNode;
  if (query.isPending) {
    content = <p role="status">{t.loading}</p>;
  } else if (query.isError) {
    const error = query.error;
    const signedOut =
      error instanceof CohabitationError && error.kind === "signed-out";
    content = (
      <div role="alert">
        <p className="error-message">{t.loadErrors[loadFailure(error)]}</p>
        {signedOut ? (
          <Link className="button" href="/login">
            {t.signIn}
          </Link>
        ) : (
          <button
            className="button"
            type="button"
            onClick={() => query.refetch()}
          >
            {t.retry}
          </button>
        )}
      </div>
    );
  } else {
    const { me, cohabitations } = query.data;
    const shown = cohabitations.filter((c) => c.status !== "declined");
    const ready = profile.data?.status === "ready" ? profile.data : null;
    const suggestFor = ready?.profile.is_available
      ? shown.find((c) => c.status === "active" && !suggested.includes(c.id))
      : undefined;

    content = (
      <>
        {suggestFor && ready && (
          <div
            className="cohabitation-suggestion"
            role="region"
            aria-labelledby="cohabitation-suggestion-title"
          >
            <p id="cohabitation-suggestion-title">{t.mine.suggestion}</p>
            <div className="confirm-actions">
              <button
                type="button"
                className="button button-outline"
                onClick={() => dismiss(suggestFor.id)}
              >
                {t.mine.notNow}
              </button>
              <button
                type="button"
                className="button"
                disabled={turnOff.isPending}
                aria-busy={turnOff.isPending || undefined}
                onClick={() =>
                  turnOff.mutate({
                    userId: ready.userId,
                    cohabitationId: suggestFor.id,
                  })
                }
              >
                {t.mine.turnOff}
              </button>
            </div>
            {turnOff.isError && (
              <p className="error-message" role="alert">
                {i18n.m.profile.errors[turnOff.error.kind]}
              </p>
            )}
          </div>
        )}
        {shown.length === 0 ? (
          <p className="muted">{t.mine.empty}</p>
        ) : (
          <ul className="cohabitation-list">
            {shown.map((c) => {
              const peerName = c.peerName ?? t.mine.unknownPeer;
              return (
                <li key={c.id} className="cohabitation-item">
                  <span className="match-request-text">
                    <b>{peerName}</b>
                    <small>
                      {t.status[cohabitationStatus(c, me)]} ·{" "}
                      {monthSpanLabel(c.startedMonth, c.endedMonth, i18n)}
                    </small>
                  </span>
                  <Link
                    className="text-link"
                    href={`/chats/${encodeURIComponent(c.matchId)}`}
                    aria-label={i18n.format(t.mine.openChatWith, {
                      name: peerName,
                    })}
                  >
                    {t.mine.openChat}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </>
    );
  }

  return (
    <section
      className="profile-section cohabitation-section"
      aria-labelledby="my-cohabitations-title"
    >
      <h2 id="my-cohabitations-title">{t.mine.title}</h2>
      <p className="muted">{t.mine.intro}</p>
      {content}
    </section>
  );
}
