type DbError = { code?: string; message?: string; status?: number } | null;

/** Android detail-screen copy (`ListingScreens.kt`). */
export function listingStatusLabel(isFilled: boolean): string {
  return isFilled ? "Zapolnjeno" : "Na voljo";
}

export function filledToggleLabel(isFilled: boolean): string {
  return isFilled ? "Označi kot na voljo" : "Označi kot zapolnjeno";
}

/** Match requests are only possible for available listings (Android disables the button). */
export function canRequestMatch(isFilled: boolean): boolean {
  return !isFilled;
}

/** Structural subset of the Supabase client used to change a listing's state. */
export type ListingStatusClient = {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string } | null };
      error: DbError;
    }>;
  };
  from: (table: "listings") => {
    update: (values: { is_filled: boolean }) => {
      eq: (
        column: "id",
        value: string,
      ) => {
        eq: (
          column: "owner_id",
          value: string,
        ) => {
          select: (columns: "id,is_filled") => {
            maybeSingle: () => PromiseLike<{
              data: { id: string; is_filled: boolean } | null;
              error: DbError;
            }>;
          };
        };
      };
    };
  };
};

export type StatusErrorKind =
  "signed-out" | "gone" | "permission" | "offline" | "unknown";

export const statusErrorMessages: Record<StatusErrorKind, string> = {
  "signed-out": "Za spreminjanje stanja oglasa se moraš prijaviti.",
  gone: "Stanja oglasa ni bilo mogoče spremeniti. Oglas ne obstaja več ali nisi njegov lastnik.",
  permission: "Nimaš dovoljenja za spreminjanje tega oglasa.",
  offline: "Ni povezave. Stanje oglasa ni bilo spremenjeno.",
  unknown: "Stanja oglasa ni bilo mogoče spremeniti.",
};

export class ListingStatusError extends Error {
  constructor(public readonly kind: StatusErrorKind) {
    super(statusErrorMessages[kind]);
    this.name = "ListingStatusError";
  }
}

function toStatusError(error: unknown): ListingStatusError {
  if (error instanceof ListingStatusError) return error;
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
    return new ListingStatusError("permission");
  }
  if (
    error instanceof TypeError ||
    /fetch|network/i.test(details.message ?? "")
  ) {
    return new ListingStatusError("offline");
  }
  return new ListingStatusError("unknown");
}

/**
 * Marks the owner's listing as filled or available (Android `markFilled`) and
 * returns the state confirmed by the database. Only `is_filled` is sent; the
 * owner filter mirrors RLS so an empty result is reported, not treated as success.
 */
export async function setListingFilled(
  client: ListingStatusClient,
  id: string,
  filled: boolean,
): Promise<boolean> {
  try {
    if (!id) throw new ListingStatusError("gone");
    const { data: userData } = await client.auth.getUser();
    if (!userData.user) throw new ListingStatusError("signed-out");
    const { data, error } = await client
      .from("listings")
      .update({ is_filled: filled })
      .eq("id", id)
      .eq("owner_id", userData.user.id)
      .select("id,is_filled")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ListingStatusError("gone");
    return data.is_filled;
  } catch (error) {
    throw toStatusError(error);
  }
}

/**
 * Optimistic toggle used by the UI (Android `toggleFilled`): applies the new
 * state immediately, then settles on the server value or rolls back on error.
 */
export async function toggleFilledOptimistically(
  current: boolean,
  apply: (filled: boolean) => void,
  persist: (filled: boolean) => Promise<boolean>,
): Promise<
  { ok: true; filled: boolean } | { ok: false; error: ListingStatusError }
> {
  const next = !current;
  apply(next);
  try {
    const confirmed = await persist(next);
    apply(confirmed);
    return { ok: true, filled: confirmed };
  } catch (error) {
    apply(current);
    return { ok: false, error: toStatusError(error) };
  }
}
