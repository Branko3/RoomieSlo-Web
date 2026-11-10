"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { RatingSummaryView } from "../../components/rating-summary";
import { getSupabaseConfig } from "../../lib/config";
import {
  QUESTIONNAIRE_ROUTE,
  readinessMessage,
  recommendationReadiness,
} from "../../lib/matching/answer-sufficiency";
import {
  loadRecommendations,
  nameAndAge,
  RecommendationsError,
  type RecommendationsClient,
} from "../../lib/matching/recommendations";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";
import { VerifiedIcon } from "../../components/icons";
import { useI18n } from "../../lib/i18n/provider";

export default function RecommendationsPage() {
  const i18n = useI18n();
  const { m, format } = i18n;
  const copy = m.matching.recommendations;
  const configured = getSupabaseConfig().configured;
  const query = useQuery({
    queryKey: ["recommendations"],
    enabled: configured,
    queryFn: () =>
      loadRecommendations(
        createSupabaseBrowserClient() as unknown as RecommendationsClient,
      ),
  });

  let body: React.ReactNode;
  if (!configured) {
    body = (
      <p className="error-message" role="alert">
        {copy.unavailable}
      </p>
    );
  } else if (query.isPending) {
    body = <p role="status">{copy.loading}</p>;
  } else if (query.isError) {
    const signedOut =
      query.error instanceof RecommendationsError &&
      query.error.kind === "signed-out";
    body = (
      <div className="page-state" role="alert">
        <h2>{signedOut ? copy.signedOutTitle : copy.failedTitle}</h2>
        <p>
          {query.error instanceof RecommendationsError
            ? copy.errors[query.error.kind]
            : copy.errors.unknown}
        </p>
        {signedOut ? (
          <Link className="button" href="/login">
            {copy.signIn}
          </Link>
        ) : (
          <button
            className="button"
            type="button"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
          >
            {m.common.actions.retry}
          </button>
        )}
      </div>
    );
  } else if (
    readinessMessage(recommendationReadiness(query.data.myAnswers), i18n)
  ) {
    const message = readinessMessage(
      recommendationReadiness(query.data.myAnswers),
      i18n,
    )!;
    body = (
      <div className="empty-state questionnaire-needed">
        <span aria-hidden="true">✦</span>
        <h2>{message.title}</h2>
        <p>{message.body}</p>
        <Link className="button" href={QUESTIONNAIRE_ROUTE}>
          {copy.fillQuestionnaire}
        </Link>
      </div>
    );
  } else if (query.data.recommendations.length === 0) {
    body = (
      <div className="empty-state">
        <h2>{copy.emptyTitle}</h2>
        <p>{copy.emptyBody}</p>
      </div>
    );
  } else {
    body = (
      <ol className="recommendation-list">
        {query.data.recommendations.map(
          ({ profile, compatibility, sharedStatements, ratings }) => (
            <li className="recommendation-card" key={profile.id}>
              <div className="recommendation-head">
                <div>
                  <h2>{nameAndAge(profile)}</h2>
                  {profile.faculty && (
                    <p className="muted">{profile.faculty}</p>
                  )}
                </div>
                {sharedStatements > 0 ? (
                  <span
                    className="compatibility-badge"
                    aria-label={format(copy.compatibility, {
                      percent: compatibility,
                    })}
                  >
                    {compatibility}%
                  </span>
                ) : (
                  <span
                    className="compatibility-badge compatibility-unknown"
                    aria-label={copy.noSharedAnswers}
                    title={copy.noSharedAnswersHint}
                  >
                    —
                  </span>
                )}
              </div>
              <div className="chips">
                {profile.verified && (
                  <span className="chip chip-green chip-icon">
                    <VerifiedIcon size={14} />
                    {copy.verified}
                  </span>
                )}
                {profile.available && (
                  <span className="chip">{copy.lookingForRoommate}</span>
                )}
              </div>
              {ratings && <RatingSummaryView summary={ratings} />}
              {profile.bio && (
                <p className="recommendation-bio">{profile.bio}</p>
              )}
            </li>
          ),
        )}
      </ol>
    );
  }

  return (
    <div className="content-wrap narrow-content">
      <header className="topbar">
        <div>
          <h1>{copy.title}</h1>
          <p className="muted">{copy.subtitle}</p>
        </div>
      </header>
      {body}
    </div>
  );
}
