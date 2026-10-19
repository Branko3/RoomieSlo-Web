"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseConfig } from "../lib/config";
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
  questionnaireErrorMessages,
  saveMyAnswers,
  type QuestionnaireClient,
} from "../lib/questionnaire/persistence";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";

type Load =
  | { status: "loading" }
  | { status: "ready"; userId: string }
  | { status: "failed"; error: QuestionnaireError };

export function LifestyleQuestionnaire() {
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
  const [saveError, setSaveError] = useState<string | null>(null);
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
        error instanceof QuestionnaireError
          ? error.message
          : questionnaireErrorMessages.unknown,
      );
      setSaving(false);
    }
  }

  const header = (
    <header className="topbar">
      <div>
        <h1>Vprašalnik o življenjskem slogu</h1>
        {load.status === "ready" && (
          <p className="muted" aria-live="polite">
            Izpolnjenih {expressedCount(answers)} od {STATEMENTS.length} trditev
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
          Preskoči
        </button>
      )}
    </header>
  );

  if (load.status === "loading") {
    return (
      <div className="content-wrap narrow-content">
        {header}
        <p role="status">Nalaganje vprašalnika …</p>
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
            <b>
              {signedOut
                ? "Nisi prijavljen"
                : "Vprašalnika ni bilo mogoče naložiti"}
            </b>
            <p>
              {configured || signedOut
                ? load.error.message
                : "Vprašalnik trenutno ni na voljo."}
            </p>
          </div>
          {signedOut ? (
            <Link className="button" href="/login">
              Prijava
            </Link>
          ) : (
            configured && (
              <button
                className="button button-outline"
                type="button"
                onClick={() => setAttempt((value) => value + 1)}
              >
                Poskusi znova
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
      <p className="muted questionnaire-intro">
        Označi, koliko se strinjaš s trditvami. Vprašalnik lahko kadar koli
        preskočiš; neodgovorjene trditve ne vplivajo na ujemanje.
      </p>
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
              {statement.text}
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
                {level.label}
              </label>
            ))}
          </fieldset>
        ))}
        {saveError && (
          <p className="error-message" role="alert">
            {saveError}
          </p>
        )}
        <button className="button full-button" type="submit" disabled={saving}>
          {saving ? "Shranjujem …" : "Shrani in nadaljuj"}
        </button>
      </form>
    </div>
  );
}
