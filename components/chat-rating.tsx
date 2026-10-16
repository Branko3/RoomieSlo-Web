"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";
import { loadMatchCohabitations } from "../lib/cohabitation/cohabitation";
import { dateLabel } from "../lib/cohabitation/months";
import {
  loadMyRating,
  ratableCohabitation,
  RatingError,
  ratingLoadFailure,
  ratingMessages,
  submitRating,
  type MyRating,
  type RatingAnswers,
} from "../lib/ratings/ratings";
import { ratingAction, ratingReminder } from "../lib/ratings/rules";
import { ratingCopy } from "../lib/ratings/summary";
import {
  IMPROVEMENT_TAGS,
  improvementLabels,
  MAX_TAGS,
  STRENGTH_TAGS,
  strengthLabels,
  type ImprovementTag,
  type StrengthTag,
} from "../lib/ratings/tags";
import {
  cohabitationClient,
  matchCohabitationsKey,
  myRatingKey,
  ratingClient,
  RATINGS_KEY,
} from "./cohabitation-queries";

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

/** The rating form: Da/Ne (required), up to 3 strengths, up to 3 private improvements. */
export function RatingForm({
  peerName,
  initial,
  busy,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  peerName: string;
  initial: MyRating | null;
  busy: boolean;
  submitLabel: string;
  onSubmit: (answers: RatingAnswers) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const [wouldLiveAgain, setWouldLiveAgain] = useState<boolean | null>(
    initial?.wouldLiveAgain ?? null,
  );
  const [strengths, setStrengths] = useState<StrengthTag[]>(
    initial?.strengths ?? [],
  );
  const [improvements, setImprovements] = useState<ImprovementTag[]>(
    initial?.improvements ?? [],
  );
  const [missingAnswer, setMissingAnswer] = useState(false);
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => first.current?.focus(), []);

  return (
    <form
      className="confirm-panel rating-form"
      aria-labelledby={`${id}-title`}
      onSubmit={(event) => {
        event.preventDefault();
        if (busy) return;
        if (wouldLiveAgain === null) {
          setMissingAnswer(true);
          first.current?.focus();
          return;
        }
        onSubmit({ wouldLiveAgain, strengths, improvements });
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") onCancel();
      }}
    >
      <p id={`${id}-title`}>
        <b>Ocena sobivanja z osebo {peerName}</b>
      </p>
      <p className="muted">{ratingCopy.anonymity}</p>

      <fieldset
        aria-describedby={missingAnswer ? `${id}-missing` : undefined}
        aria-invalid={missingAnswer || undefined}
      >
        <legend>Bi spet živel(a) s to osebo? (obvezno)</legend>
        {[
          { value: true, label: "Da" },
          { value: false, label: "Ne" },
        ].map((option, index) => (
          <label key={option.label} className="rating-option">
            <input
              ref={index === 0 ? first : undefined}
              type="radio"
              name={`${id}-again`}
              checked={wouldLiveAgain === option.value}
              onChange={() => {
                setWouldLiveAgain(option.value);
                setMissingAnswer(false);
              }}
            />
            {option.label}
          </label>
        ))}
        {missingAnswer && (
          <p id={`${id}-missing`} className="error-message" role="alert">
            Odgovori Da ali Ne.
          </p>
        )}
      </fieldset>

      <fieldset>
        <legend>
          Močne točke (največ {MAX_TAGS}, vidne drugim v povzetku)
        </legend>
        {STRENGTH_TAGS.map((tag) => (
          <label key={tag} className="rating-option">
            <input
              type="checkbox"
              checked={strengths.includes(tag)}
              disabled={
                !strengths.includes(tag) && strengths.length >= MAX_TAGS
              }
              onChange={() => setStrengths(toggle(strengths, tag))}
            />
            {strengthLabels[tag]}
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>
          Področja za izboljšanje (največ {MAX_TAGS}, vidi jih samo ta oseba v
          povzetku)
        </legend>
        {IMPROVEMENT_TAGS.map((tag) => (
          <label key={tag} className="rating-option">
            <input
              type="checkbox"
              checked={improvements.includes(tag)}
              disabled={
                !improvements.includes(tag) && improvements.length >= MAX_TAGS
              }
              onChange={() => setImprovements(toggle(improvements, tag))}
            />
            {improvementLabels[tag]}
          </label>
        ))}
      </fieldset>

      <div className="confirm-actions">
        <button
          type="button"
          className="button button-outline"
          onClick={onCancel}
        >
          Prekliči
        </button>
        <button
          type="submit"
          className="button"
          disabled={busy}
          aria-busy={busy || undefined}
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

/** My submitted answers, visible only to me. */
function OwnRatingSummary({ rating }: { rating: MyRating }) {
  const tags = [
    ...rating.strengths.map((tag) => strengthLabels[tag]),
    ...rating.improvements.map((tag) => `${improvementLabels[tag]} (zasebno)`),
  ];
  return (
    <p className="muted">
      Tvoja ocena: {rating.wouldLiveAgain ? "Da" : "Ne"}
      {tags.length > 0 && ` · ${tags.join(", ")}`}
    </p>
  );
}

/**
 * Rating in a conversation: a reminder when the window opens and 7 days
 * before it closes, the rating form, and my own rating (editable while hidden,
 * updatable every 6 months while still living together).
 */
export function ChatRating({
  matchId,
  peerName,
}: {
  matchId: string;
  peerName: string;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const cohabitations = useQuery({
    queryKey: matchCohabitationsKey(matchId),
    queryFn: () => loadMatchCohabitations(cohabitationClient(), matchId),
  });
  const cohabitation = cohabitations.data
    ? ratableCohabitation(cohabitations.data.cohabitations)
    : null;
  const mine = useQuery({
    queryKey: myRatingKey(cohabitation?.id ?? ""),
    enabled: Boolean(cohabitation),
    queryFn: () => loadMyRating(ratingClient(), cohabitation!.id),
  });
  const mutation = useMutation({
    mutationFn: (answers: RatingAnswers) =>
      submitRating(ratingClient(), cohabitation!, answers, mine.data ?? null),
    onSuccess: (rating) => {
      queryClient.setQueryData(myRatingKey(rating.cohabitationId), rating);
      setOpen(false);
      setAnnouncement("Ocena je shranjena.");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: RATINGS_KEY }),
  });

  // Loading and errors of the cohabitation itself are shown by ChatCohabitation.
  if (!cohabitation) return null;
  if (mine.isPending) return null;
  if (mine.isError)
    return (
      <div className="rating" role="alert">
        <p className="error-message">{ratingLoadFailure(mine.error)}</p>
        <button
          type="button"
          className="text-link"
          onClick={() => mine.refetch()}
        >
          Poskusi znova
        </button>
      </div>
    );

  const rating = mine.data;
  const action = ratingAction(cohabitation, rating);
  const reminder = ratingReminder(action);
  if (action.kind === "unavailable" && !rating) return null;

  const closePanel = () => {
    setOpen(false);
    mutation.reset();
    trigger.current?.focus();
  };
  const actionLabel =
    action.kind === "rate"
      ? "Oceni"
      : action.kind === "edit"
        ? "Uredi oceno"
        : action.kind === "update"
          ? "Posodobi oceno"
          : null;

  return (
    <section
      className={reminder ? "rating rating-banner" : "rating"}
      aria-label="Ocena sobivanja"
    >
      {reminder && (
        <p>
          <b>Lahko oceniš sobivanje z osebo {peerName}.</b>{" "}
          {reminder === "closing" && action.window?.closesAt
            ? `Ocenjevanje se zapre ${dateLabel(action.window.closesAt)}.`
            : "Ocena je anonimna."}
        </p>
      )}
      {rating && (
        <>
          <OwnRatingSummary rating={rating} />
          <p className="muted">
            {rating.status === "hidden"
              ? "Tvoja ocena še ni vidna: prikaže se, ko oceni tudi druga oseba ali po 14 dneh."
              : action.kind === "locked" && action.until
                ? `Oceno lahko posodobiš od ${dateLabel(action.until)} dalje.`
                : "Tvoja ocena je upoštevana."}
          </p>
        </>
      )}
      {actionLabel && (
        <button
          ref={trigger}
          type="button"
          className={reminder ? "button" : "text-link"}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {actionLabel}
        </button>
      )}
      {actionLabel && open && (
        <RatingForm
          peerName={peerName}
          initial={rating}
          busy={mutation.isPending}
          submitLabel={rating ? "Shrani oceno" : "Oddaj oceno"}
          onCancel={closePanel}
          onSubmit={(answers) => mutation.mutate(answers)}
        />
      )}
      {mutation.isError && (
        <p className="error-message" role="alert">
          {mutation.error instanceof RatingError
            ? mutation.error.message
            : ratingMessages.unknown}
        </p>
      )}
      <p className="sr-only" role="status">
        {announcement}
      </p>
    </section>
  );
}
