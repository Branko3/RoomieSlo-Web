"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import {
  backHref,
  DEFAULT_REASON,
  DESCRIPTION_MAX,
  isUserId,
  parseReportContext,
  REPORT_REASONS,
  reportCopy,
  ReportError,
  submitReport,
  type ReportClient,
} from "../../../lib/reports/report";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";
import { ChevronLeftIcon } from "../../../components/icons";

function ReportForm({ userId }: { userId: string }) {
  const params = useSearchParams();
  const context = parseReportContext(params);
  const [reason, setReason] = useState<string>(DEFAULT_REASON);
  const [description, setDescription] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      submitReport(createSupabaseBrowserClient() as unknown as ReportClient, {
        reportedId: userId,
        reason,
        description,
        context,
      }),
  });

  if (!isUserId(userId)) {
    return (
      <div className="page-state" role="alert">
        <h1>Prijava ni mogoča</h1>
        <p>{reportCopy.invalidUser}</p>
        <Link className="button" href={backHref(context)}>
          Nazaj
        </Link>
      </div>
    );
  }

  if (mutation.isSuccess) {
    return (
      <div className="page-state" role="status">
        <h1>Prijava poslana</h1>
        <p>{reportCopy.sent}</p>
        <Link className="button" href={backHref(context)}>
          Nazaj
        </Link>
      </div>
    );
  }

  const error =
    mutation.error instanceof ReportError
      ? mutation.error
      : mutation.error
        ? new ReportError("failed", reportCopy.failed)
        : null;
  const tooLong = description.trim().length > DESCRIPTION_MAX;

  return (
    <div className="content-wrap report-page">
      <Link className="back-link" href={backHref(context)}>
        <ChevronLeftIcon size={18} />
        Nazaj
      </Link>
      <h1>
        {context?.kind === "listing" ? "Prijavi oglas" : "Prijavi uporabnika"}
      </h1>
      <p className="muted">
        Prijavo pregleda administrator. Prijavljena oseba ne izve, kdo jo je
        prijavil.
      </p>
      <form
        className="report-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!mutation.isPending) mutation.mutate();
        }}
      >
        <fieldset className="report-reasons" disabled={mutation.isPending}>
          <legend>Razlog</legend>
          {REPORT_REASONS.map((option) => (
            <label key={option} className="report-reason">
              <input
                type="radio"
                name="reason"
                value={option}
                checked={reason === option}
                onChange={() => setReason(option)}
              />
              {option}
            </label>
          ))}
        </fieldset>
        <label className="report-description">
          Dodatni opis (neobvezno)
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            maxLength={DESCRIPTION_MAX}
            disabled={mutation.isPending}
            aria-invalid={tooLong}
            aria-describedby="report-description-count"
          />
          <small id="report-description-count" className="muted">
            {description.trim().length}/{DESCRIPTION_MAX}
          </small>
        </label>
        {error && (
          <p className="report-error" role="alert">
            {error.message}{" "}
            {error.kind === "signed-out" && <Link href="/login">Prijava</Link>}
          </p>
        )}
        <button
          className="button full-button"
          type="submit"
          disabled={mutation.isPending || tooLong}
        >
          {mutation.isPending ? "Pošiljam..." : "Pošlji prijavo"}
        </button>
      </form>
    </div>
  );
}

export default function ReportPage({ params }: { params: { userId: string } }) {
  return (
    <Suspense
      fallback={
        <div className="page-state">
          <p>Nalaganje ...</p>
        </div>
      }
    >
      <ReportForm userId={decodeURIComponent(params.userId)} />
    </Suspense>
  );
}
