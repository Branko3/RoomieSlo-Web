"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ListingForm } from "../../../components/listing-form";
import { getSupabaseConfig } from "../../../lib/config";
import {
  createListing,
  emptyListingDraft,
  ListingSaveError,
  listingSaveErrorMessages,
  type ListingCreateClient,
  type ListingValues,
} from "../../../lib/listings/listing-form";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";

export default function NewListingPage() {
  const router = useRouter();
  const configured = getSupabaseConfig().configured;

  async function save(values: ListingValues): Promise<string | null> {
    try {
      const id = await createListing(
        createSupabaseBrowserClient() as unknown as ListingCreateClient,
        values,
      );
      router.push(`/listings/${encodeURIComponent(id)}`);
      return null;
    } catch (error) {
      return error instanceof ListingSaveError
        ? error.message
        : listingSaveErrorMessages.unknown;
    }
  }

  return (
    <div className="content-wrap narrow-content">
      <Link className="back-link" href="/listings">
        ← Na oglase
      </Link>
      <header className="topbar">
        <div>
          <h1>Objavi oglas</h1>
        </div>
      </header>
      {configured ? (
        <ListingForm
          initialDraft={emptyListingDraft}
          submitLabel="Objavi oglas"
          onSubmit={save}
        />
      ) : (
        <p className="error-message" role="alert">
          Objava oglasov trenutno ni na voljo. Poskusi znova kasneje.
        </p>
      )}
    </div>
  );
}
