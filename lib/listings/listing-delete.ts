type DbError = { code?: string; message?: string; status?: number } | null;

/** Structural subset of the Supabase client used to delete a listing. */
export type ListingDeleteClient = {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string } | null };
      error: DbError;
    }>;
  };
  from: (table: "listings") => {
    delete: () => {
      eq: (
        column: "id",
        value: string,
      ) => {
        eq: (
          column: "owner_id",
          value: string,
        ) => {
          select: (
            columns: "id",
          ) => PromiseLike<{ data: { id: string }[] | null; error: DbError }>;
        };
      };
    };
  };
};

export type DeleteErrorKind =
  "signed-out" | "gone" | "permission" | "offline" | "unknown";

export const deleteErrorMessages: Record<DeleteErrorKind, string> = {
  "signed-out": "Za brisanje oglasa se moraš prijaviti.",
  gone: "Oglasa ni bilo mogoče izbrisati. Ne obstaja več ali nisi njegov lastnik.",
  permission: "Nimaš dovoljenja za brisanje tega oglasa.",
  offline: "Ni povezave. Preveri internet in poskusi znova.",
  unknown: "Oglasa ni bilo mogoče izbrisati.",
};

export class ListingDeleteError extends Error {
  constructor(public readonly kind: DeleteErrorKind) {
    super(deleteErrorMessages[kind]);
    this.name = "ListingDeleteError";
  }
}

function toDeleteError(error: unknown): ListingDeleteError {
  if (error instanceof ListingDeleteError) return error;
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
    return new ListingDeleteError("permission");
  }
  if (
    error instanceof TypeError ||
    /fetch|network/i.test(details.message ?? "")
  ) {
    return new ListingDeleteError("offline");
  }
  return new ListingDeleteError("unknown");
}

/**
 * Deletes a listing owned by the current user (Android `ListingRepository.deleteListing`).
 * The owner filter mirrors RLS so a non-owner request deletes nothing; an
 * empty result is reported instead of claiming success. Favorites referencing
 * the listing are removed by the `on delete cascade` foreign key.
 */
export async function deleteListing(
  client: ListingDeleteClient,
  id: string,
): Promise<void> {
  try {
    if (!id) throw new ListingDeleteError("gone");
    const { data: userData } = await client.auth.getUser();
    if (!userData.user) throw new ListingDeleteError("signed-out");
    const { data, error } = await client
      .from("listings")
      .delete()
      .eq("id", id)
      .eq("owner_id", userData.user.id)
      .select("id");
    if (error) throw error;
    if (!data || data.length === 0) throw new ListingDeleteError("gone");
  } catch (error) {
    throw toDeleteError(error);
  }
}
