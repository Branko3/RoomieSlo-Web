"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  loadMySummary,
  RatingError,
  ratingLoadFailure,
  ratingMessages,
  setRatingsVisible,
} from "../lib/ratings/ratings";
import {
  belowThresholdLabel,
  improvementCountLabel,
  ratingCopy,
  shownHeadline,
  strengthCountLabel,
  type MyRatingSummary,
} from "../lib/ratings/summary";
import { MY_RATING_SUMMARY_KEY, ratingClient } from "./cohabitation-queries";

/**
 * "Ocene sostanovalcev" on `/profile`: my own aggregate (with the private
 * "Področja za izboljšanje"), the count below the threshold, and the
 * "Prikaži ocene sostanovalcev" setting. Never who gave which rating.
 */
export function MyRatingsSection() {
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
    content = <p role="status">Nalaganje ocen …</p>;
  } else if (query.isError) {
    const signedOut =
      query.error instanceof RatingError && query.error.kind === "signed-out";
    content = (
      <div role="alert">
        <p className="error-message">{ratingLoadFailure(query.error)}</p>
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
  } else {
    const summary = query.data;
    content = (
      <>
        {summary.state === "insufficient" ? (
          <p>{belowThresholdLabel(summary.count)}</p>
        ) : (
          <>
            <p>
              <b>{shownHeadline(summary)}</b>
            </p>
            {summary.strengths.length > 0 && (
              <ul className="chips" aria-label="Najpogostejše močne točke">
                {summary.strengths.map((s) => (
                  <li key={s.tag} className="chip chip-green rating-chip">
                    {strengthCountLabel(s)}
                  </li>
                ))}
              </ul>
            )}
            <h3 className="rating-subtitle">{ratingCopy.improvementsTitle}</h3>
            {summary.improvements.length > 0 ? (
              <ul className="rating-improvements">
                {summary.improvements.map((s) => (
                  <li key={s.tag}>{improvementCountLabel(s)}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">Nihče ni označil področij za izboljšanje.</p>
            )}
            <p className="muted">
              Področja za izboljšanje vidiš samo ti. Nihče ne vidi, kdo je dal
              katero oceno.
            </p>
          </>
        )}

        <div className="profile-card rating-visibility">
          <div>
            <b id="ratings-visible-label">Prikaži ocene sostanovalcev</b>
            <p>
              {summary.visible
                ? "Drugi vidijo povzetek, ko imaš vsaj 3 ocene."
                : "Drugi vidijo »Ocene so skrite«. Ocene se še vedno zbirajo in jih lahko kadar koli znova prikažeš."}
            </p>
            {visibility.isError && (
              <p className="error-message" role="alert">
                {visibility.error instanceof RatingError
                  ? visibility.error.message
                  : ratingMessages.unknown}
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
      <h2 id="my-ratings-title">Ocene sostanovalcev</h2>
      <p className="muted">
        Ocenijo te lahko samo osebe, s katerimi imaš potrjeno sobivanje.
        Povzetek drugim pokažemo šele od 3 ocen naprej.
      </p>
      {content}
    </section>
  );
}
