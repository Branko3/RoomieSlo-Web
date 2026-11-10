"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, type CSSProperties } from "react";
import {
  fetchOwnProfile,
  updateAvailability,
  type OwnProfileResult,
  type ProfileClient,
  type ProfileRequestError,
} from "../lib/profile/own-profile";
import { useI18n } from "../lib/i18n/provider";
import { questionnaireProgress } from "../lib/questionnaire/model";
import {
  loadMyAnswers,
  type QuestionnaireClient,
} from "../lib/questionnaire/persistence";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";
import { OWN_PROFILE_QUERY_KEY } from "./own-profile-section";
import { ChevronRightIcon } from "./icons";

/**
 * "Iščem sostanovalca / sobo" (Android `setAvailability`): optimistic, saved to
 * `profiles.is_available`, rolled back with a message if the save fails.
 */
export function AvailabilityCard() {
  const { m } = useI18n();
  const t = m.profile.availability;
  const client = useMemo(
    () => createSupabaseBrowserClient() as unknown as ProfileClient,
    [],
  );
  const queryClient = useQueryClient();
  const query = useQuery<OwnProfileResult, ProfileRequestError>({
    queryKey: OWN_PROFILE_QUERY_KEY,
    queryFn: () => fetchOwnProfile(client),
  });
  const mutation = useMutation<
    unknown,
    ProfileRequestError,
    { userId: string; isAvailable: boolean },
    { previous?: OwnProfileResult }
  >({
    mutationFn: ({ userId, isAvailable }) =>
      updateAvailability(client, userId, isAvailable),
    onMutate: async ({ isAvailable }) => {
      await queryClient.cancelQueries({ queryKey: OWN_PROFILE_QUERY_KEY });
      const previous = queryClient.getQueryData<OwnProfileResult>(
        OWN_PROFILE_QUERY_KEY,
      );
      if (previous?.status === "ready") {
        const next: OwnProfileResult = {
          ...previous,
          profile: { ...previous.profile, is_available: isAvailable },
        };
        queryClient.setQueryData(OWN_PROFILE_QUERY_KEY, next);
      }
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous)
        queryClient.setQueryData(OWN_PROFILE_QUERY_KEY, context.previous);
    },
  });

  // Loading, errors and signed-out states are shown by the profile header.
  if (query.data?.status !== "ready") return null;
  const { userId, profile } = query.data;
  const available = profile.is_available;

  return (
    <section className="profile-card">
      <div>
        <b>{t.title}</b>
        <p>{t.body}</p>
        {mutation.isError && (
          <p className="error-message" role="alert">
            {m.profile.errors[mutation.error.kind]}
          </p>
        )}
      </div>
      <button
        className={`toggle ${available ? "on" : ""}`}
        type="button"
        onClick={() => {
          // Not `disabled`, so keyboard focus stays on the toggle while saving.
          if (!mutation.isPending)
            mutation.mutate({ userId, isAvailable: !available });
        }}
        aria-busy={mutation.isPending || undefined}
        aria-label={t.toggle}
        aria-pressed={available}
      >
        <span />
      </button>
    </section>
  );
}

/** Questionnaire progress from the saved answers (Android "Izpolnjenih X od N trditev"). */
export function QuestionnaireProgressCard() {
  const { m, format } = useI18n();
  const t = m.questionnaire;
  const client = useMemo(
    () => createSupabaseBrowserClient() as unknown as QuestionnaireClient,
    [],
  );
  const query = useQuery({
    queryKey: ["questionnaire", "mine"],
    queryFn: () => loadMyAnswers(client),
  });
  const progress = query.data
    ? questionnaireProgress(query.data.answers)
    : null;
  const done = progress !== null && progress.answered === progress.total;

  return (
    <section className="profile-card questionnaire">
      <div
        className="progress-ring"
        aria-hidden="true"
        style={{ "--percent": progress?.percent ?? 0 } as CSSProperties}
      >
        {progress ? `${progress.percent}%` : "…"}
      </div>
      <div>
        <b>{t.title}</b>
        <p role={query.isPending ? "status" : undefined}>
          {progress
            ? format(t.progress, {
                answered: progress.answered,
                total: progress.total,
              })
            : query.isError
              ? t.card.progressFailed
              : t.card.loading}
        </p>
        <div
          className="progress"
          role="progressbar"
          aria-label={t.card.progressLabel}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress?.percent ?? 0}
        >
          <span style={{ width: `${progress?.percent ?? 0}%` }} />
        </div>
      </div>
      <Link className="link-chevron" href="/profile/questionnaire">
        {done
          ? t.card.edit
          : progress?.answered
            ? t.card.continue
            : t.card.start}
        <ChevronRightIcon size={16} />
      </Link>
    </section>
  );
}
