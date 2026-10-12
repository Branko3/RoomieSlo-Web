import type { Database } from "../supabase/types";

type ListingInsert = Database["public"]["Tables"]["listings"]["Insert"];

/** Room types offered when publishing (Android `VRSTE_NASTANITVE`); stored as text. */
export const ROOM_TYPES = [
  "soba",
  "garsonjera",
  "deljeno stanovanje",
  "celo stanovanje",
] as const;

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

export type ListingValidation =
  | { ok: true; values: ListingValues }
  | { ok: false; errors: Partial<Record<ListingField, string>> };

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
 * a real `YYYY-MM-DD` date or empty ("po dogovoru").
 */
export function validateListingDraft(draft: ListingDraft): ListingValidation {
  const errors: Partial<Record<ListingField, string>> = {};
  const location = draft.location.trim();
  const title = draft.title.trim();
  const description = draft.description.trim();
  const roomType = draft.roomType.trim();
  const district = draft.district.trim();
  const availableFrom = draft.availableFrom.trim();

  if (!location) errors.location = "Vnesi lokacijo.";
  else if (location.length > LISTING_LIMITS.locationMax) {
    errors.location = `Lokacija je lahko dolga največ ${LISTING_LIMITS.locationMax} znakov.`;
  }

  const priceText = draft.price.trim();
  if (!priceText) errors.price = "Vnesi ceno.";
  else if (!/^\d+$/.test(priceText))
    errors.price = "Cena mora biti celo število evrov.";
  else if (Number(priceText) > LISTING_LIMITS.priceMax) {
    errors.price = `Cena je lahko največ ${LISTING_LIMITS.priceMax} €.`;
  }

  if (title.length > LISTING_LIMITS.titleMax) {
    errors.title = `Naslov je lahko dolg največ ${LISTING_LIMITS.titleMax} znakov.`;
  }
  if (description.length > LISTING_LIMITS.descriptionMax) {
    errors.description = `Opis je lahko dolg največ ${LISTING_LIMITS.descriptionMax} znakov.`;
  }
  if (roomType && !(ROOM_TYPES as readonly string[]).includes(roomType)) {
    errors.roomType = "Izberi vrsto nastanitve s seznama.";
  }
  if (district && !(DISTRICTS as readonly string[]).includes(district)) {
    errors.district = "Izberi četrt s seznama.";
  }
  if (availableFrom && !isValidIsoDate(availableFrom)) {
    errors.availableFrom = "Datum vselitve vpiši v obliki LLLL-MM-DD.";
  }

  const numeric: Array<[ListingField, string, number]> = [
    ["sizeSqm", "Velikost", LISTING_LIMITS.sizeMax],
    ["deposit", "Varščina", LISTING_LIMITS.depositMax],
    ["flatmates", "Število sostanovalcev", LISTING_LIMITS.flatmatesMax],
  ];
  for (const [field, label, max] of numeric) {
    const text = String(draft[field]).trim();
    if (!text) continue;
    if (!/^\d+$/.test(text)) errors[field] = `${label} mora biti celo število.`;
    else if (Number(text) > max)
      errors[field] = `${label} je lahko največ ${max}.`;
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

export const listingSaveErrorMessages: Record<ListingSaveErrorKind, string> = {
  "signed-out": "Za objavo oglasa se moraš prijaviti.",
  permission: "Nimaš dovoljenja za objavo tega oglasa. Prijavi se znova.",
  invalid: "Nekateri podatki niso veljavni. Preveri obrazec in poskusi znova.",
  offline: "Ni povezave. Preveri internet in poskusi znova.",
  unknown: "Shranjevanje ni uspelo. Poskusi znova.",
};

export class ListingSaveError extends Error {
  constructor(public readonly kind: ListingSaveErrorKind) {
    super(listingSaveErrorMessages[kind]);
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
