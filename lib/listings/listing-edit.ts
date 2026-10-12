import type { Database } from "../supabase/types";
import {
  ListingSaveError,
  toListingSaveError,
  type ListingDraft,
  type ListingValues,
} from "./listing-form";

type ListingRow = Database["public"]["Tables"]["listings"]["Row"];
type DbError = { code?: string; message?: string; status?: number } | null;

export const EDITABLE_COLUMNS =
  "id,owner_id,version,location,price_per_month,description,title,room_type,district,available_from,size_sqm,deposit,bills_included,furnished,flatmates_count";

export type EditableListingRow = Pick<
  ListingRow,
  | "id"
  | "owner_id"
  | "version"
  | "location"
  | "price_per_month"
  | "description"
  | "title"
  | "room_type"
  | "district"
  | "available_from"
  | "size_sqm"
  | "deposit"
  | "bills_included"
  | "furnished"
  | "flatmates_count"
>;

/** Structural subset of the Supabase client used to edit a listing. */
export type ListingEditClient = {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string } | null };
      error: DbError;
    }>;
  };
  from: (table: "listings") => {
    select: (columns: string) => {
      eq: (
        column: "id",
        value: string,
      ) => {
        maybeSingle: () => PromiseLike<{
          data: EditableListingRow | null;
          error: DbError;
        }>;
      };
    };
    update: (values: ListingValues & { version: number }) => {
      eq: (
        column: "id",
        value: string,
      ) => {
        eq: (
          column: "version",
          value: number,
        ) => {
          select: (columns: "id") => {
            maybeSingle: () => PromiseLike<{
              data: { id: string } | null;
              error: DbError;
            }>;
          };
        };
      };
    };
  };
};

/** Prefills the form like Android: whole euros, empty optional fields, flatmates 0 shown empty. */
export function draftFromListing(row: EditableListingRow): ListingDraft {
  const whole = (value: number | null) =>
    value === null ? "" : String(Math.trunc(value));
  return {
    location: row.location,
    price: whole(row.price_per_month),
    description: row.description,
    title: row.title,
    roomType: row.room_type,
    district: row.district,
    availableFrom: row.available_from ?? "",
    sizeSqm: row.size_sqm === null ? "" : String(row.size_sqm),
    deposit: whole(row.deposit === null ? null : Number(row.deposit)),
    billsIncluded: row.bills_included,
    furnished: row.furnished,
    flatmates: row.flatmates_count > 0 ? String(row.flatmates_count) : "",
  };
}

export type EditableListing =
  | { status: "ready"; draft: ListingDraft; version: number }
  | { status: "not-found" }
  | { status: "not-owner" };

/**
 * Loads a listing for editing. Only the owner may edit; RLS enforces this on
 * update, and the UI shows a permission state instead of a form that would fail.
 */
export async function loadListingForEdit(
  client: ListingEditClient,
  id: string,
): Promise<EditableListing> {
  try {
    if (!id) return { status: "not-found" };
    const { data: userData } = await client.auth.getUser();
    if (!userData.user) throw new ListingSaveError("signed-out");
    const { data, error } = await client
      .from("listings")
      .select(EDITABLE_COLUMNS)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { status: "not-found" };
    if (data.owner_id !== userData.user.id) return { status: "not-owner" };
    return {
      status: "ready",
      draft: draftFromListing(data),
      version: data.version,
    };
  } catch (error) {
    throw toListingSaveError(error);
  }
}

export const LISTING_CONFLICT_MESSAGE =
  "Oglas je bil medtem spremenjen ali odstranjen. Osveži stran in poskusi znova.";

export class ListingConflictError extends Error {
  constructor() {
    super(LISTING_CONFLICT_MESSAGE);
    this.name = "ListingConflictError";
  }
}

/**
 * Updates the owner-editable columns with optimistic concurrency: the row is
 * changed only if its `version` still matches, and the version is bumped. No
 * returned row means another edit won, the listing was deleted, or RLS hid it.
 * `owner_id`, `is_filled`, `created_at`, and `id` are never sent.
 */
export async function updateListing(
  client: ListingEditClient,
  id: string,
  expectedVersion: number,
  values: ListingValues,
): Promise<number> {
  try {
    const nextVersion = expectedVersion + 1;
    const { data, error } = await client
      .from("listings")
      .update({ ...values, version: nextVersion })
      .eq("id", id)
      .eq("version", expectedVersion)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ListingConflictError();
    return nextVersion;
  } catch (error) {
    if (error instanceof ListingConflictError) throw error;
    throw toListingSaveError(error);
  }
}
