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
  reasonKey,
  REPORT_REASONS,
  ReportError,
  submitReport,
  type ReportClient,
  type ReportErrorKind,
} from "../../../lib/reports/report";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";
import { ChevronLeftIcon } from "../../../components/icons";
import { useI18n } from "../../../lib/i18n/provider";

function ReportForm({ userId }: { userId: string }) {
  const { m, format } = useI18n();
  const copy = m.reports;
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
        <h1>{copy.unavailableTitle}</h1>
        <p>{copy.errors["invalid-user"]}</p>
        <Link className="button" href={backHref(context)}>
          {copy.back}
        </Link>
      </div>
    );
  }

  if (mutation.isSuccess) {
    return (
      <div className="page-state" role="status">
        <h1>{copy.sentTitle}</h1>
        <p>{copy.sent}</p>
        <Link className="button" href={backHref(context)}>
          {copy.back}
        </Link>
      </div>
    );
  }

  const error: ReportErrorKind | null =
    mutation.error instanceof ReportError
      ? mutation.error.kind
      : mutation.error
        ? "failed"
        : null;
  const tooLong = description.trim().length > DESCRIPTION_MAX;

  return (
    <div className="content-wrap report-page">
      <Link className="back-link" href={backHref(context)}>
        <ChevronLeftIcon size={18} />
        {copy.back}
      </Link>
      <h1>
        {context?.kind === "listing" ? copy.titleListing : copy.titleUser}
      </h1>
      <p className="muted">{copy.intro}</p>
      <form
        className="report-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!mutation.isPending) mutation.mutate();
        }}
      >
        <fieldset className="report-reasons" disabled={mutation.isPending}>
          <legend>{copy.reason}</legend>
          {REPORT_REASONS.map((option) => (
            <label key={option} className="report-reason">
              <input
                type="radio"
                name="reason"
                value={option}
                checked={reason === option}
                onChange={() => setReason(option)}
              />
              {copy.reasons[reasonKey(option) ?? "other"]}
            </label>
          ))}
        </fieldset>
        <label className="report-description">
          {copy.description}
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
            {format(copy.errors[error], { max: DESCRIPTION_MAX })}{" "}
            {error === "signed-out" && <Link href="/login">{copy.signIn}</Link>}
          </p>
        )}
        <button
          className="button full-button"
          type="submit"
          disabled={mutation.isPending || tooLong}
        >
          {mutation.isPending ? copy.submitting : copy.submit}
        </button>
      </form>
    </div>
  );
}

export default function ReportPage({ params }: { params: { userId: string } }) {
  const { m } = useI18n();
  return (
    <Suspense
      fallback={
        <div className="page-state">
          <p>{m.reports.loading}</p>
        </div>
      }
    >
      <ReportForm userId={decodeURIComponent(params.userId)} />
    </Suspense>
  );
}
