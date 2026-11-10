"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";
import { loadMatchCohabitations } from "../lib/cohabitation/cohabitation";
import { useI18n } from "../lib/i18n/provider";
import {
  loadMyRating,
  ratableCohabitation,
  RatingError,
  ratingLoadFailure,
  submitRating,
  type MyRating,
  type RatingAnswers,
} from "../lib/ratings/ratings";
import { ratingAction, ratingReminder } from "../lib/ratings/rules";
import {
  IMPROVEMENT_TAGS,
  MAX_TAGS,
  STRENGTH_TAGS,
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
  const { m, format } = useI18n();
  const t = m.ratings;
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
        <b>{format(t.form.title, { name: peerName })}</b>
      </p>
      <p className="muted">{t.anonymity}</p>

      <fieldset
        aria-describedby={missingAnswer ? `${id}-missing` : undefined}
        aria-invalid={missingAnswer || undefined}
      >
        <legend>{t.form.wouldLiveAgain}</legend>
        {[
          { value: true, label: t.form.yes },
          { value: false, label: t.form.no },
        ].map((option, index) => (
          <label key={String(option.value)} className="rating-option">
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
            {t.form.missingAnswer}
          </p>
        )}
      </fieldset>

      <fieldset>
        <legend>{format(t.form.strengthsLegend, { max: MAX_TAGS })}</legend>
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
            {t.strengths[tag]}
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>{format(t.form.improvementsLegend, { max: MAX_TAGS })}</legend>
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
            {t.improvements[tag]}
          </label>
        ))}
      </fieldset>

      <div className="confirm-actions">
        <button
          type="button"
          className="button button-outline"
          onClick={onCancel}
        >
          {t.form.cancel}
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
  const { m, format } = useI18n();
  const t = m.ratings;
  const tags = [
    ...rating.strengths.map((tag) => t.strengths[tag]),
    ...rating.improvements.map((tag) =>
      format(t.chat.privateTag, { label: t.improvements[tag] }),
    ),
  ];
  return (
    <p className="muted">
      {format(t.chat.ownRating, {
        answer: rating.wouldLiveAgain ? t.form.yes : t.form.no,
      })}
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
  const { m, format, formatters } = useI18n();
  const t = m.ratings;
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [announced, setAnnounced] = useState(false);
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
      setAnnounced(true);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: RATINGS_KEY }),
  });

  // Loading and errors of the cohabitation itself are shown by ChatCohabitation.
  if (!cohabitation) return null;
  if (mine.isPending) return null;
  if (mine.isError)
    return (
      <div className="rating" role="alert">
        <p className="error-message">
          {t.loadErrors[ratingLoadFailure(mine.error)]}
        </p>
        <button
          type="button"
          className="text-link"
          onClick={() => mine.refetch()}
        >
          {t.chat.retry}
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
      ? t.chat.rate
      : action.kind === "edit"
        ? t.chat.edit
        : action.kind === "update"
          ? t.chat.update
          : null;

  return (
    <section
      className={reminder ? "rating rating-banner" : "rating"}
      aria-label={t.chat.sectionLabel}
    >
      {reminder && (
        <p>
          <b>{format(t.chat.reminder, { name: peerName })}</b>{" "}
          {reminder === "closing" && action.window?.closesAt
            ? format(t.chat.closesOn, {
                date: formatters.date(action.window.closesAt),
              })
            : t.chat.anonymous}
        </p>
      )}
      {rating && (
        <>
          <OwnRatingSummary rating={rating} />
          <p className="muted">
            {rating.status === "hidden"
              ? t.chat.hidden
              : action.kind === "locked" && action.until
                ? format(t.chat.updateFrom, {
                    date: formatters.date(action.until),
                  })
                : t.chat.counted}
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
          submitLabel={rating ? t.chat.save : t.chat.submit}
          onCancel={closePanel}
          onSubmit={(answers) => mutation.mutate(answers)}
        />
      )}
      {mutation.isError && (
        <p className="error-message" role="alert">
          {
            t.errors[
              mutation.error instanceof RatingError
                ? mutation.error.kind
                : "unknown"
            ]
          }
        </p>
      )}
      <p className="sr-only" role="status">
        {announced && t.chat.saved}
      </p>
    </section>
  );
}
