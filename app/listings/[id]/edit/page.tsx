"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ListingForm } from "../../../../components/listing-form";
import { getSupabaseConfig } from "../../../../lib/config";
import { useI18n } from "../../../../lib/i18n/provider";
import {
  ListingConflictError,
  loadListingForEdit,
  updateListing,
  type EditableListing,
  type ListingEditClient,
} from "../../../../lib/listings/listing-edit";
import {
  ListingSaveError,
  type ListingSubmitFailure,
  type ListingValues,
} from "../../../../lib/listings/listing-form";
import { createSupabaseBrowserClient } from "../../../../lib/supabase/browser";
import { ChevronLeftIcon } from "../../../../components/icons";

type State =
  | { status: "loading" }
  | { status: "failed"; error: ListingSaveError }
  | EditableListing;

export default function EditListingPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const router = useRouter();
  const { m } = useI18n();
  const text = m.listings.edit;
  const configured = getSupabaseConfig().configured;
  const client = useMemo(
    () =>
      configured
        ? (createSupabaseBrowserClient() as unknown as ListingEditClient)
        : null,
    [configured],
  );
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!client) {
      setState({ status: "failed", error: new ListingSaveError("unknown") });
      return;
    }
    let active = true;
    setState({ status: "loading" });
    loadListingForEdit(client, id)
      .then((result) => active && setState(result))
      .catch(
        (error: ListingSaveError) =>
          active && setState({ status: "failed", error }),
      );
    return () => {
      active = false;
    };
  }, [client, id, attempt]);

  async function save(
    values: ListingValues,
  ): Promise<ListingSubmitFailure | null> {
    if (!client || state.status !== "ready") return "unknown";
    try {
      await updateListing(client, id, state.version, values);
      router.push(`/listings/${encodeURIComponent(id)}`);
      return null;
    } catch (error) {
      if (error instanceof ListingConflictError) return "conflict";
      return error instanceof ListingSaveError ? error.kind : "unknown";
    }
  }

  let body: React.ReactNode;
  if (state.status === "loading") {
    body = <p role="status">{text.loading}</p>;
  } else if (state.status === "not-found") {
    body = (
      <div className="page-state">
        <h2>{text.goneTitle}</h2>
        <p>{text.goneBody}</p>
        <Link className="button" href="/listings">
          {text.toListings}
        </Link>
      </div>
    );
  } else if (state.status === "not-owner") {
    body = (
      <div className="page-state" role="alert">
        <h2>{text.notOwnerTitle}</h2>
        <p>{text.notOwnerBody}</p>
        <Link className="button" href={`/listings/${encodeURIComponent(id)}`}>
          {text.backToListing}
        </Link>
      </div>
    );
  } else if (state.status === "failed") {
    const signedOut = state.error.kind === "signed-out";
    body = (
      <div className="page-state" role="alert">
        <h2>{signedOut ? text.signedOutTitle : text.loadFailedTitle}</h2>
        <p>
          {!configured
            ? text.unavailable
            : signedOut
              ? text.signedOutBody
              : m.listings.form.saveErrors[state.error.kind]}
        </p>
        {signedOut ? (
          <Link className="button" href="/login">
            {text.signIn}
          </Link>
        ) : (
          configured && (
            <button
              className="button"
              type="button"
              onClick={() => setAttempt((value) => value + 1)}
            >
              {m.common.actions.retry}
            </button>
          )
        )}
      </div>
    );
  } else {
    body = (
      <ListingForm
        key={state.version}
        initialDraft={state.draft}
        submitLabel={text.submit}
        onSubmit={save}
      />
    );
  }

  return (
    <div className="content-wrap narrow-content">
      <Link className="back-link" href={`/listings/${encodeURIComponent(id)}`}>
        <ChevronLeftIcon size={18} />
        {text.back}
      </Link>
      <header className="topbar">
        <div>
          <h1>{text.title}</h1>
        </div>
      </header>
      {body}
    </div>
  );
}
