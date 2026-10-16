import {
  strengthCountLabel,
  summaryHeadline,
  type RatingSummary,
} from "../lib/ratings/summary";

/**
 * A person's roommate rating summary as other people see it: the "would live
 * again" ratio and the most common strengths, or a neutral line below the
 * threshold or when ratings are hidden. Never who gave which rating.
 */
export function RatingSummaryView({ summary }: { summary: RatingSummary }) {
  return (
    <div className="rating-summary">
      <p className={summary.state === "shown" ? "" : "muted"}>
        {summaryHeadline(summary)}
      </p>
      {summary.state === "shown" && summary.strengths.length > 0 && (
        <ul className="chips" aria-label="Najpogostejše močne točke">
          {summary.strengths.map((strength) => (
            <li key={strength.tag} className="chip chip-green rating-chip">
              {strengthCountLabel(strength)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
