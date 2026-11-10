import type { Database } from "../supabase/types";
import { isRoomType } from "./room-types";

export { ROOM_TYPES } from "./room-types";

type ListingInsert = Database["public"]["Tables"]["listings"]["Insert"];

/** Ljubljana districts offered when publishing (Android `CETRTI`). */
export const DISTRICTS = [
  "Bežigrad",
  "Center",
  "Šiška",
  "Vič",
  "Moste",
  "Rudnik",
  "Trnovo",
  "Rožna dolina",
  "Črnuče",
] as const;

export const LISTING_LIMITS = {
  locationMax: 120,
  titleMax: 120,
  descriptionMax: 2000,
  priceMax: 100_000,
  depositMax: 100_000,
  sizeMax: 1000,
  flatmatesMax: 20,
} as const;

/** Form state; numeric fields are strings because they come from text inputs (Android parity). */
export type ListingDraft = {
  location: string;
  price: string;
  description: string;
  title: string;
  roomType: string;
  district: string;
  availableFrom: string;
  sizeSqm: string;
  deposit: string;
  billsIncluded: boolean;
  furnished: boolean;
  flatmates: string;
};

export type ListingField = keyof ListingDraft;

export const emptyListingDraft: ListingDraft = {
  location: "",
  price: "",
  description: "",
  title: "",
  roomType: "",
  district: "",
  availableFrom: "",
  sizeSqm: "",
  deposit: "",
  billsIncluded: false,
  furnished: false,
  flatmates: "",
};

/** Owner-editable listing columns; id, owner_id, created_at, is_filled, and version are set by the database. */
export type ListingValues = Required<
  Pick<
    ListingInsert,
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
  >
>;

/** Validation codes; the form shows `m.listings.form.errors[code]` with `{max}`. */
export type ListingErrorCode =
  | "locationRequired"
  | "locationTooLong"
  | "priceRequired"
  | "priceNotInteger"
  | "priceTooLarge"
  | "titleTooLong"
  | "descriptionTooLong"
  | "roomTypeInvalid"
  | "districtInvalid"
  | "availableFromInvalid"
  | "sizeSqmNotInteger"
  | "sizeSqmTooLarge"
  | "depositNotInteger"
  | "depositTooLarge"
  | "flatmatesNotInteger"
  | "flatmatesTooLarge";

export type ListingFieldError = { code: ListingErrorCode; max?: number };

export type ListingErrors = Partial<Record<ListingField, ListingFieldError>>;

export type ListingValidation =
  { ok: true; values: ListingValues } | { ok: false; errors: ListingErrors };

/** Android numeric inputs keep digits only. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function optionalInt(value: string): number | null {
  const digits = value.trim();
  return digits ? Number(digits) : null;
}

/**
 * Validates and converts the form (Android `CreateListingViewModel.save` plus
 * `PodatkiOglasa.ocisceni`): location and price are required, text is
 * trimmed, empty optional numbers mean "no data", and the move-in date must be
 * a real `YYYY-MM-DD` date or empty (by arrangement).
 */
export function validateListingDraft(draft: ListingDraft): ListingValidation {
  const errors: ListingErrors = {};
  const location = draft.location.trim();
  const title = draft.title.trim();
  const description = draft.description.trim();
  const roomType = draft.roomType.trim();
  const district = draft.district.trim();
  const availableFrom = draft.availableFrom.trim();

  if (!location) errors.location = { code: "locationRequired" };
  else if (location.length > LISTING_LIMITS.locationMax) {
    errors.location = {
      code: "locationTooLong",
      max: LISTING_LIMITS.locationMax,
    };
  }

  const priceText = draft.price.trim();
  if (!priceText) errors.price = { code: "priceRequired" };
  else if (!/^\d+$/.test(priceText)) errors.price = { code: "priceNotInteger" };
  else if (Number(priceText) > LISTING_LIMITS.priceMax) {
    errors.price = { code: "priceTooLarge", max: LISTING_LIMITS.priceMax };
  }

  if (title.length > LISTING_LIMITS.titleMax) {
    errors.title = { code: "titleTooLong", max: LISTING_LIMITS.titleMax };
  }
  if (description.length > LISTING_LIMITS.descriptionMax) {
    errors.description = {
      code: "descriptionTooLong",
      max: LISTING_LIMITS.descriptionMax,
    };
  }
  if (roomType && !isRoomType(roomType)) {
    errors.roomType = { code: "roomTypeInvalid" };
  }
  if (district && !(DISTRICTS as readonly string[]).includes(district)) {
    errors.district = { code: "districtInvalid" };
  }
  if (availableFrom && !isValidIsoDate(availableFrom)) {
    errors.availableFrom = { code: "availableFromInvalid" };
  }

  const numeric = [
    ["sizeSqm", LISTING_LIMITS.sizeMax],
    ["deposit", LISTING_LIMITS.depositMax],
    ["flatmates", LISTING_LIMITS.flatmatesMax],
  ] as const;
  for (const [field, max] of numeric) {
    const text = String(draft[field]).trim();
    if (!text) continue;
    if (!/^\d+$/.test(text)) errors[field] = { code: `${field}NotInteger` };
    else if (Number(text) > max)
      errors[field] = { code: `${field}TooLarge`, max };
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    values: {
      location,
      price_per_month: Number(priceText),
      description,
      title,
      room_type: roomType,
      district,
      available_from: availableFrom || null,
      size_sqm: optionalInt(draft.sizeSqm),
      deposit: optionalInt(draft.deposit),
      bills_included: draft.billsIncluded,
      furnished: draft.furnished,
      flatmates_count: optionalInt(draft.flatmates) ?? 0,
    },
  };
}

type DbError = { code?: string; message?: string; status?: number } | null;

/** Structural subset of the Supabase client used to create a listing. */
export type ListingCreateClient = {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string } | null };
      error: DbError;
    }>;
  };
  from: (table: "listings") => {
    insert: (row: ListingValues & { owner_id: string }) => {
      select: (columns: "id") => {
        single: () => PromiseLike<{
          data: { id: string } | null;
          error: DbError;
        }>;
      };
    };
  };
};

export type ListingSaveErrorKind =
  "signed-out" | "permission" | "invalid" | "offline" | "unknown";

/** Why saving the form failed: a save error, or an edit conflict (`ListingConflictError`). */
export type ListingSubmitFailure = ListingSaveErrorKind | "conflict";

/** Errors carry a kind; the UI shows `m.listings.form.saveErrors[kind]`. */
export class ListingSaveError extends Error {
  constructor(public readonly kind: ListingSaveErrorKind) {
    super(`Listing save failed: ${kind}`);
    this.name = "ListingSaveError";
  }
}

export function toListingSaveError(error: unknown): ListingSaveError {
  if (error instanceof ListingSaveError) return error;
  const details = (error ?? {}) as {
    code?: string;
    status?: number;
    message?: string;
  };
  if (
    details.code === "42501" ||
    details.status === 401 ||
    details.status === 403
  ) {
    return new ListingSaveError("permission");
  }
  // 22xxx = data exception (e.g. invalid date), 23xxx = constraint violation.
  if (details.code?.startsWith("22") || details.code?.startsWith("23")) {
    return new ListingSaveError("invalid");
  }
  if (
    error instanceof TypeError ||
    /fetch|network/i.test(details.message ?? "")
  ) {
    return new ListingSaveError("offline");
  }
  return new ListingSaveError("unknown");
}

/**
 * Inserts a listing owned by the current user and returns its id. RLS requires
 * `owner_id = auth.uid()`; the id comes from the verified user, never the form.
 */
export async function createListing(
  client: ListingCreateClient,
  values: ListingValues,
): Promise<string> {
  try {
    const { data: userData } = await client.auth.getUser();
    if (!userData.user) throw new ListingSaveError("signed-out");
    const { data, error } = await client
      .from("listings")
      .insert({ ...values, owner_id: userData.user.id })
      .select("id")
      .single();
    if (error) throw error;
    if (!data?.id) throw new ListingSaveError("unknown");
    return data.id;
  } catch (error) {
    throw toListingSaveError(error);
  }
}
