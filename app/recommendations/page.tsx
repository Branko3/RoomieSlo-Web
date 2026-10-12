"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { getSupabaseConfig } from "../../lib/config";
import {
  QUESTIONNAIRE_ROUTE,
  readinessMessage,
  recommendationReadiness,
  sharedStatementCount,
} from "../../lib/matching/answer-sufficiency";
import {
  loadRecommendations,
  nameAndAge,
  RecommendationsError,
  type RecommendationsClient,
} from "../../lib/matching/recommendations";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";

export default function RecommendationsPage() {
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
        Priporočila trenutno niso na voljo.
      </p>
    );
  } else if (query.isPending) {
    body = <p role="status">Nalaganje priporočil …</p>;
  } else if (query.isError) {
    const signedOut =
      query.error instanceof RecommendationsError &&
      query.error.kind === "signed-out";
    body = (
      <div className="page-state" role="alert">
        <h2>
          {signedOut ? "Nisi prijavljen" : "Priporočil ni mogoče naložiti"}
        </h2>
        <p>
          {query.error instanceof RecommendationsError
            ? query.error.message
            : "Napaka pri nalaganju priporočil."}
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
            disabled={query.isFetching}
          >
            Poskusi znova
          </button>
        )}
      </div>
    );
  } else if (readinessMessage(recommendationReadiness(query.data.myAnswers))) {
    const message = readinessMessage(
      recommendationReadiness(query.data.myAnswers),
    )!;
    body = (
      <div className="empty-state questionnaire-needed">
        <span aria-hidden="true">✦</span>
        <h2>{message.title}</h2>
        <p>{message.body}</p>
        <Link className="button" href={QUESTIONNAIRE_ROUTE}>
          Izpolni vprašalnik
        </Link>
      </div>
    );
  } else if (query.data.recommendations.length === 0) {
    body = (
      <div className="empty-state">
        <h2>Ni razpoložljivih profilov za priporočilo.</h2>
        <p>
          Ko bodo drugi študenti iskali sostanovalca, se bodo prikazali tukaj.
        </p>
      </div>
    );
  } else {
    body = (
      <ol className="recommendation-list">
        {query.data.recommendations.map(({ profile, compatibility }) => (
          <li className="recommendation-card" key={profile.id}>
            <div className="recommendation-head">
              <div>
                <h2>{nameAndAge(profile)}</h2>
                {profile.faculty && <p className="muted">{profile.faculty}</p>}
              </div>
              {sharedStatementCount(query.data.myAnswers, profile.answers) >
              0 ? (
                <span
                  className="compatibility-badge"
                  aria-label={`Združljivost ${compatibility} %`}
                >
                  {compatibility}%
                </span>
              ) : (
                <span
                  className="compatibility-badge compatibility-unknown"
                  aria-label="Združljivosti ni mogoče izračunati: ni skupnih odgovorov"
                  title="Ni skupnih odgovorov na vprašalnik"
                >
                  —
                </span>
              )}
            </div>
            <div className="chips">
              {profile.verified && (
                <span className="chip chip-green">✓ Preverjen študent</span>
              )}
              {profile.available && (
                <span className="chip">Išče sostanovalca</span>
              )}
            </div>
            {profile.bio && <p className="recommendation-bio">{profile.bio}</p>}
          </li>
        ))}
      </ol>
    );
  }

  return (
    <div className="content-wrap narrow-content">
      <header className="topbar">
        <div>
          <p className="eyebrow">UJEMANJE</p>
          <h1>Priporočeni profili</h1>
          <p className="muted">
            Razvrščeni po združljivosti glede na vprašalnik o življenjskem
            slogu.
          </p>
        </div>
      </header>
      {body}
    </div>
  );
}
