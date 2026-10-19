"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ListingForm } from "../../../../components/listing-form";
import { getSupabaseConfig } from "../../../../lib/config";
import {
  ListingConflictError,
  loadListingForEdit,
  updateListing,
  type EditableListing,
  type ListingEditClient,
} from "../../../../lib/listings/listing-edit";
import {
  ListingSaveError,
  listingSaveErrorMessages,
  type ListingValues,
} from "../../../../lib/listings/listing-form";
import { createSupabaseBrowserClient } from "../../../../lib/supabase/browser";

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

  async function save(values: ListingValues): Promise<string | null> {
    if (!client || state.status !== "ready")
      return listingSaveErrorMessages.unknown;
    try {
      await updateListing(client, id, state.version, values);
      router.push(`/listings/${encodeURIComponent(id)}`);
      return null;
    } catch (error) {
      if (error instanceof ListingConflictError) return error.message;
      return error instanceof ListingSaveError
        ? error.message
        : listingSaveErrorMessages.unknown;
    }
  }

  let body: React.ReactNode;
  if (state.status === "loading") {
    body = <p role="status">Nalaganje oglasa …</p>;
  } else if (state.status === "not-found") {
    body = (
      <div className="page-state">
        <h2>Oglas ni več na voljo</h2>
        <p>Ta oglas ne obstaja ali je bil odstranjen.</p>
        <Link className="button" href="/listings">
          Na oglase
        </Link>
      </div>
    );
  } else if (state.status === "not-owner") {
    body = (
      <div className="page-state" role="alert">
        <h2>Tega oglasa ne moreš urejati</h2>
        <p>Urejati ga lahko samo lastnik oglasa.</p>
        <Link className="button" href={`/listings/${encodeURIComponent(id)}`}>
          Nazaj na oglas
        </Link>
      </div>
    );
  } else if (state.status === "failed") {
    const signedOut = state.error.kind === "signed-out";
    body = (
      <div className="page-state" role="alert">
        <h2>{signedOut ? "Nisi prijavljen" : "Oglasa ni mogoče naložiti"}</h2>
        <p>
          {!configured
            ? "Urejanje oglasov trenutno ni na voljo."
            : signedOut
              ? "Za urejanje oglasa se moraš prijaviti."
              : state.error.message}
        </p>
        {signedOut ? (
          <Link className="button" href="/login">
            Prijava
          </Link>
        ) : (
          configured && (
            <button
              className="button"
              type="button"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Poskusi znova
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
        submitLabel="Shrani spremembe"
        onSubmit={save}
      />
    );
  }

  return (
    <div className="content-wrap narrow-content">
      <Link className="back-link" href={`/listings/${encodeURIComponent(id)}`}>
        ← Nazaj na oglas
      </Link>
      <header className="topbar">
        <div>
          <h1>Uredi oglas</h1>
        </div>
      </header>
      {body}
    </div>
  );
}
