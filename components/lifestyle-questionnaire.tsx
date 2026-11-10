"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseConfig } from "../lib/config";
import { useI18n } from "../lib/i18n/provider";
import type { Messages } from "../lib/i18n/types";
import {
  expressedCount,
  isExpressed,
  LIKERT,
  STATEMENTS,
  type Answers,
  type LikertKey,
} from "../lib/questionnaire/model";
import {
  destinationAfterSave,
  loadMyAnswers,
  QuestionnaireError,
  saveMyAnswers,
  type QuestionnaireClient,
  type QuestionnaireErrorKind,
} from "../lib/questionnaire/persistence";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";

type Load =
  | { status: "loading" }
  | { status: "ready"; userId: string }
  | { status: "failed"; error: QuestionnaireError };

type StatementId = keyof Messages["questionnaire"]["statements"];

export function LifestyleQuestionnaire() {
  const { m, format } = useI18n();
  const t = m.questionnaire;
  const router = useRouter();
  const from = useSearchParams().get("from");
  const configured = getSupabaseConfig().configured;
  const client = useMemo(
    () =>
      configured
        ? (createSupabaseBrowserClient() as unknown as QuestionnaireClient)
        : null,
    [configured],
  );
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [answers, setAnswers] = useState<Answers>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<QuestionnaireErrorKind | null>(
    null,
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!client) {
      setLoad({ status: "failed", error: new QuestionnaireError("unknown") });
      return;
    }
    let active = true;
    setLoad({ status: "loading" });
    loadMyAnswers(client)
      .then(({ userId, answers: stored }) => {
        if (!active) return;
        setAnswers(stored);
        setLoad({ status: "ready", userId });
      })
      .catch((error: QuestionnaireError) => {
        if (active) setLoad({ status: "failed", error });
      });
    return () => {
      active = false;
    };
  }, [client, attempt]);

  async function save() {
    if (!client || load.status !== "ready" || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveMyAnswers(client, load.userId, answers);
      router.push(destinationAfterSave(from));
    } catch (error) {
      setSaveError(
        error instanceof QuestionnaireError ? error.kind : "unknown",
      );
      setSaving(false);
    }
  }

  const header = (
    <header className="topbar">
      <div>
        <h1>{t.title}</h1>
        {load.status === "ready" && (
          <p className="muted" aria-live="polite">
            {format(t.progress, {
              answered: expressedCount(answers),
              total: STATEMENTS.length,
            })}
          </p>
        )}
      </div>
      {load.status === "ready" && (
        <button
          className="text-link"
          type="button"
          onClick={save}
          disabled={saving}
        >
          {t.skip}
        </button>
      )}
    </header>
  );

  if (load.status === "loading") {
    return (
      <div className="content-wrap narrow-content">
        {header}
        <p role="status">{t.loading}</p>
      </div>
    );
  }

  if (load.status === "failed") {
    const signedOut = load.error.kind === "signed-out";
    return (
      <div className="content-wrap narrow-content">
        {header}
        <div className="profile-card" role="alert">
          <div>
            <b>{signedOut ? t.signedOutTitle : t.loadFailedTitle}</b>
            <p>
              {configured || signedOut
                ? t.errors[load.error.kind]
                : t.unavailable}
            </p>
          </div>
          {signedOut ? (
            <Link className="button" href="/login">
              {t.signIn}
            </Link>
          ) : (
            configured && (
              <button
                className="button button-outline"
                type="button"
                onClick={() => setAttempt((value) => value + 1)}
              >
                {t.retry}
              </button>
            )
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="content-wrap narrow-content">
      {header}
      <p className="muted questionnaire-intro">{t.intro}</p>
      <form
        className="questionnaire-form"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        {STATEMENTS.map((statement, index) => (
          <fieldset className="likert" key={statement.id} disabled={saving}>
            <legend>
              <span className="likert-number">{index + 1}.</span>{" "}
              {t.statements[statement.id as StatementId]}
            </legend>
            {LIKERT.map((level) => (
              <label
                key={level.key}
                className={isExpressed(level.key) ? "" : "likert-skip"}
              >
                <input
                  type="radio"
                  name={statement.id}
                  value={level.key}
                  checked={answers[statement.id] === level.key}
                  onChange={() =>
                    setAnswers((current) => ({
                      ...current,
                      [statement.id]: level.key as LikertKey,
                    }))
                  }
                />
                {t.likert[level.key]}
              </label>
            ))}
          </fieldset>
        ))}
        {saveError && (
          <p className="error-message" role="alert">
            {t.errors[saveError]}
          </p>
        )}
        <button className="button full-button" type="submit" disabled={saving}>
          {saving ? t.saving : t.save}
        </button>
      </form>
    </div>
  );
}
