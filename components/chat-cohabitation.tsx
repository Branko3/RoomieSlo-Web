"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import {
  chatCohabitationView,
  cohabitationCopy,
  CohabitationError,
  cohabitationMessages,
  declareCohabitation,
  endCohabitation,
  loadFailureMessage,
  loadMatchCohabitations,
  respondCohabitation,
  type Cohabitation,
} from "../lib/cohabitation/cohabitation";
import {
  endedMonthOptions,
  monthLabel,
  startedMonthOptions,
} from "../lib/cohabitation/months";
import {
  cohabitationClient,
  COHABITATIONS_KEY,
  matchCohabitationsKey,
} from "./cohabitation-queries";

type MatchData = Awaited<ReturnType<typeof loadMatchCohabitations>>;

type Action =
  | { type: "declare"; month: string }
  | { type: "respond"; id: string; confirm: boolean }
  | { type: "end"; cohabitation: Cohabitation; month: string };

const announcements = {
  declare: "Poslano v potrditev.",
  confirm: "Potrjeno.",
  decline: "Označeno, da ne drži.",
  end: "Sobivanje je zaključeno.",
} as const;

/** A month picker with a submit and a cancel button. Escape cancels. */
function MonthForm({
  title,
  hint,
  label,
  options,
  submitLabel,
  busy,
  onSubmit,
  onCancel,
}: {
  title: string;
  hint?: string;
  label: string;
  options: string[];
  submitLabel: string;
  busy: boolean;
  onSubmit: (month: string) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const [month, setMonth] = useState(options[0] ?? "");
  const select = useRef<HTMLSelectElement>(null);
  useEffect(() => select.current?.focus(), []);

  return (
    <form
      className="confirm-panel cohabitation-panel"
      aria-labelledby={`${id}-title`}
      onSubmit={(event) => {
        event.preventDefault();
        if (month && !busy) onSubmit(month);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") onCancel();
      }}
    >
      <p id={`${id}-title`}>
        <b>{title}</b>
      </p>
      {hint && <p className="muted">{hint}</p>}
      <label htmlFor={`${id}-month`}>{label}</label>
      <select
        id={`${id}-month`}
        ref={select}
        value={month}
        onChange={(event) => setMonth(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {monthLabel(option)}
          </option>
        ))}
      </select>
      <div className="confirm-actions">
        <button
          type="button"
          className="button button-outline"
          onClick={onCancel}
        >
          {cohabitationCopy.cancel}
        </button>
        <button
          type="submit"
          className="button"
          disabled={busy || !month}
          aria-busy={busy || undefined}
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

/**
 * "Živiva skupaj" in an accepted conversation: the declare action, the
 * confirm banner for the other person, the active chip with "Ne živiva več
 * skupaj", and "Ni potrjeno" for the declarer after a decline.
 */
export function ChatCohabitation({
  matchId,
  matchCreatedAt,
  peerName,
  canDeclare,
}: {
  matchId: string;
  matchCreatedAt: string | null;
  peerName: string;
  /** False while I block the other person or their account is deleted. */
  canDeclare: boolean;
}) {
  const queryClient = useQueryClient();
  const key = matchCohabitationsKey(matchId);
  const [panel, setPanel] = useState<"declare" | "end" | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const query = useQuery({
    queryKey: key,
    queryFn: () => loadMatchCohabitations(cohabitationClient(), matchId),
  });
  const mutation = useMutation({
    mutationFn: (action: Action) => {
      const client = cohabitationClient();
      switch (action.type) {
        case "declare":
          return declareCohabitation(client, matchId, action.month, {
            matchCreatedAt,
          });
        case "respond":
          return respondCohabitation(client, action.id, action.confirm);
        case "end":
          return endCohabitation(client, action.cohabitation, action.month);
      }
    },
    onSuccess: (row, action) => {
      queryClient.setQueryData<MatchData>(key, (data) =>
        data
          ? {
              ...data,
              cohabitations: [
                row,
                ...data.cohabitations.filter((c) => c.id !== row.id),
              ],
            }
          : data,
      );
      setPanel(null);
      setAnnouncement(
        action.type === "respond"
          ? action.confirm
            ? announcements.confirm
            : announcements.decline
          : announcements[action.type],
      );
    },
    // After success and after a conflict, so every view shows the real state.
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: COHABITATIONS_KEY }),
  });

  const closePanel = () => {
    setPanel(null);
    mutation.reset();
    trigger.current?.focus();
  };

  if (query.isPending)
    return (
      <p className="muted cohabitation-status" role="status">
        {cohabitationCopy.loading}
      </p>
    );

  if (query.isError) {
    const error = query.error;
    const signedOut =
      error instanceof CohabitationError && error.kind === "signed-out";
    return (
      <div className="cohabitation" role="alert">
        <p className="error-message">{loadFailureMessage(error)}</p>
        {signedOut ? (
          <Link className="text-link" href="/login">
            Prijava
          </Link>
        ) : (
          <button
            type="button"
            className="text-link"
            onClick={() => query.refetch()}
          >
            Poskusi znova
          </button>
        )}
      </div>
    );
  }

  const { me, cohabitations } = query.data;
  const view = chatCohabitationView(cohabitations, me);
  const busy = mutation.isPending;

  let content: React.ReactNode = null;
  if (view.kind === "awaiting-me") {
    const { cohabitation } = view;
    content = (
      <section
        className="cohabitation-banner"
        aria-labelledby={`cohabitation-banner-${cohabitation.id}`}
      >
        <p id={`cohabitation-banner-${cohabitation.id}`}>
          {cohabitationCopy.banner(peerName, cohabitation.startedMonth)}
        </p>
        <div className="confirm-actions">
          <button
            type="button"
            className="button button-outline"
            disabled={busy}
            onClick={() =>
              mutation.mutate({
                type: "respond",
                id: cohabitation.id,
                confirm: false,
              })
            }
          >
            {cohabitationCopy.decline}
          </button>
          <button
            type="button"
            className="button"
            disabled={busy || !canDeclare}
            aria-busy={busy || undefined}
            onClick={() =>
              mutation.mutate({
                type: "respond",
                id: cohabitation.id,
                confirm: true,
              })
            }
          >
            {cohabitationCopy.confirm}
          </button>
        </div>
      </section>
    );
  } else if (view.kind === "awaiting-peer") {
    content = (
      <p className="muted cohabitation-status">
        {cohabitationCopy.awaitingPeer(
          peerName,
          view.cohabitation.startedMonth,
        )}
      </p>
    );
  } else if (view.kind === "active") {
    const { cohabitation } = view;
    content = (
      <>
        <div className="chat-safety-actions cohabitation-actions">
          <span className="chip chip-green cohabitation-chip">
            {cohabitationCopy.active(cohabitation.startedMonth)}
          </span>
          <button
            ref={trigger}
            type="button"
            className="text-link"
            aria-expanded={panel === "end"}
            onClick={() => setPanel(panel === "end" ? null : "end")}
          >
            {cohabitationCopy.endAction}
          </button>
        </div>
        {panel === "end" && (
          <MonthForm
            title={cohabitationCopy.endTitle}
            label={cohabitationCopy.endedMonthLabel}
            options={endedMonthOptions(cohabitation.startedMonth)}
            submitLabel={cohabitationCopy.submitEnd}
            busy={busy}
            onCancel={closePanel}
            onSubmit={(month) =>
              mutation.mutate({ type: "end", cohabitation, month })
            }
          />
        )}
      </>
    );
  } else {
    content = (
      <>
        <div className="chat-safety-actions cohabitation-actions">
          {view.notConfirmed && (
            <span className="cohabitation-status muted">
              {cohabitationCopy.notConfirmed}
            </span>
          )}
          {canDeclare && !view.cooldownUntil && (
            <button
              ref={trigger}
              type="button"
              className="text-link"
              aria-expanded={panel === "declare"}
              onClick={() => setPanel(panel === "declare" ? null : "declare")}
            >
              {cohabitationCopy.declareAction}
            </button>
          )}
        </div>
        {canDeclare && view.cooldownUntil && (
          <p className="muted cohabitation-status">
            {cohabitationCopy.cooldown(view.cooldownUntil)}
          </p>
        )}
        {canDeclare && panel === "declare" && (
          <MonthForm
            title={cohabitationCopy.declareTitle}
            hint={cohabitationCopy.declareHint}
            label={cohabitationCopy.startedMonthLabel}
            options={startedMonthOptions(matchCreatedAt)}
            submitLabel={cohabitationCopy.submitDeclare}
            busy={busy}
            onCancel={closePanel}
            onSubmit={(month) => mutation.mutate({ type: "declare", month })}
          />
        )}
      </>
    );
  }

  return (
    <div className="cohabitation">
      {content}
      {mutation.isError && (
        <p className="error-message" role="alert">
          {mutation.error instanceof CohabitationError
            ? mutation.error.message
            : cohabitationMessages.unknown}
        </p>
      )}
      <p className="sr-only" role="status">
        {announcement}
      </p>
    </div>
  );
}
