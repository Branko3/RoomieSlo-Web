"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ListingForm } from "../../../components/listing-form";
import { getSupabaseConfig } from "../../../lib/config";
import { useI18n } from "../../../lib/i18n/provider";
import {
  createListing,
  emptyListingDraft,
  ListingSaveError,
  type ListingCreateClient,
  type ListingSubmitFailure,
  type ListingValues,
} from "../../../lib/listings/listing-form";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";
import { ChevronLeftIcon } from "../../../components/icons";

export default function NewListingPage() {
  const router = useRouter();
  const { m } = useI18n();
  const text = m.listings.create;
  const configured = getSupabaseConfig().configured;

  async function save(
    values: ListingValues,
  ): Promise<ListingSubmitFailure | null> {
    try {
      const id = await createListing(
        createSupabaseBrowserClient() as unknown as ListingCreateClient,
        values,
      );
      router.push(`/listings/${encodeURIComponent(id)}`);
      return null;
    } catch (error) {
      return error instanceof ListingSaveError ? error.kind : "unknown";
    }
  }

  return (
    <div className="content-wrap narrow-content">
      <Link className="back-link" href="/listings">
        <ChevronLeftIcon size={18} />
        {text.back}
      </Link>
      <header className="topbar">
        <div>
          <h1>{text.title}</h1>
        </div>
      </header>
      {configured ? (
        <ListingForm
          initialDraft={emptyListingDraft}
          submitLabel={text.submit}
          onSubmit={save}
        />
      ) : (
        <p className="error-message" role="alert">
          {text.unavailable}
        </p>
      )}
    </div>
  );
}
