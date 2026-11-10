"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  loadMySummary,
  RatingError,
  ratingLoadFailure,
  setRatingsVisible,
} from "../lib/ratings/ratings";
import {
  belowThresholdLabel,
  improvementCountLabel,
  shownHeadline,
  strengthCountLabel,
  type MyRatingSummary,
} from "../lib/ratings/summary";
import { useI18n } from "../lib/i18n/provider";
import { MY_RATING_SUMMARY_KEY, ratingClient } from "./cohabitation-queries";

/**
 * "Ocene sostanovalcev" on `/profile`: my own aggregate (with the private
 * "Področja za izboljšanje"), the count below the threshold, and the
 * "Prikaži ocene sostanovalcev" setting. Never who gave which rating.
 */
export function MyRatingsSection() {
  const i18n = useI18n();
  const t = i18n.m.ratings;
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: MY_RATING_SUMMARY_KEY,
    queryFn: () => loadMySummary(ratingClient()),
  });
  const visibility = useMutation({
    mutationFn: (visible: boolean) =>
      setRatingsVisible(ratingClient(), visible),
    onSuccess: (visible) =>
      queryClient.setQueryData<MyRatingSummary>(MY_RATING_SUMMARY_KEY, (s) =>
        s ? { ...s, visible } : s,
      ),
  });

  let content: React.ReactNode;
  if (query.isPending) {
    content = <p role="status">{t.mine.loading}</p>;
  } else if (query.isError) {
    const signedOut =
      query.error instanceof RatingError && query.error.kind === "signed-out";
    content = (
      <div role="alert">
        <p className="error-message">
          {t.loadErrors[ratingLoadFailure(query.error)]}
        </p>
        {signedOut ? (
          <Link className="button" href="/login">
            {t.mine.signIn}
          </Link>
        ) : (
          <button
            className="button"
            type="button"
            onClick={() => query.refetch()}
          >
            {t.mine.retry}
          </button>
        )}
      </div>
    );
  } else {
    const summary = query.data;
    content = (
      <>
        {summary.state === "insufficient" ? (
          <p>{belowThresholdLabel(summary.count, i18n)}</p>
        ) : (
          <>
            <p>
              <b>{shownHeadline(summary, i18n)}</b>
            </p>
            {summary.strengths.length > 0 && (
              <ul className="chips" aria-label={t.topStrengths}>
                {summary.strengths.map((s) => (
                  <li key={s.tag} className="chip chip-green rating-chip">
                    {strengthCountLabel(s, i18n)}
                  </li>
                ))}
              </ul>
            )}
            <h3 className="rating-subtitle">{t.improvementsTitle}</h3>
            {summary.improvements.length > 0 ? (
              <ul className="rating-improvements">
                {summary.improvements.map((s) => (
                  <li key={s.tag}>{improvementCountLabel(s, i18n)}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">{t.mine.noImprovements}</p>
            )}
            <p className="muted">{t.mine.privacyNote}</p>
          </>
        )}

        <div className="profile-card rating-visibility">
          <div>
            <b id="ratings-visible-label">{t.mine.visibilityTitle}</b>
            <p>{summary.visible ? t.mine.visibleOn : t.mine.visibleOff}</p>
            {visibility.isError && (
              <p className="error-message" role="alert">
                {
                  t.errors[
                    visibility.error instanceof RatingError
                      ? visibility.error.kind
                      : "unknown"
                  ]
                }
              </p>
            )}
          </div>
          <button
            className={`toggle ${summary.visible ? "on" : ""}`}
            type="button"
            onClick={() => {
              // Not `disabled`, so keyboard focus stays on the toggle while saving.
              if (!visibility.isPending) visibility.mutate(!summary.visible);
            }}
            aria-busy={visibility.isPending || undefined}
            aria-labelledby="ratings-visible-label"
            aria-pressed={summary.visible}
          >
            <span />
          </button>
        </div>
      </>
    );
  }

  return (
    <section
      className="profile-section rating-section"
      aria-labelledby="my-ratings-title"
    >
      <h2 id="my-ratings-title">{t.mine.title}</h2>
      <p className="muted">{t.mine.intro}</p>
      {content}
    </section>
  );
}
