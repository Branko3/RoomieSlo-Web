import { mapProfile, type Profile } from "../supabase/mappers";
import type { Database } from "../supabase/types";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

/** Fields a user may change; verification and availability are handled elsewhere. */
export type EditableProfile = Pick<
  ProfileRow,
  "display_name" | "faculty" | "age" | "bio"
>;

export type ProfileDraft = {
  displayName: string;
  faculty: string;
  age: string;
  bio: string;
};

export type ProfileField = keyof ProfileDraft;

export type ProfileValidation =
  | { ok: true; values: EditableProfile }
  | { ok: false; errors: Partial<Record<ProfileField, string>> };

export const PROFILE_LIMITS = {
  displayNameMin: 2,
  displayNameMax: 60,
  facultyMax: 120,
  bioMax: 500,
  // University students only, 18 or older (registration confirms it).
  ageMin: 18,
  ageMax: 99,
} as const;

export function draftFromProfile(profile: Profile): ProfileDraft {
  return {
    displayName: profile.display_name,
    faculty: profile.faculty,
    age: profile.age === null ? "" : String(profile.age),
    bio: profile.bio,
  };
}

export function validateProfileDraft(draft: ProfileDraft): ProfileValidation {
  const errors: Partial<Record<ProfileField, string>> = {};
  const displayName = draft.displayName.trim().replace(/\s+/g, " ");
  const faculty = draft.faculty.trim();
  const bio = draft.bio.trim();
  const ageText = draft.age.trim();

  if (displayName.length < PROFILE_LIMITS.displayNameMin) {
    errors.displayName = "Vnesi ime z vsaj 2 znakoma.";
  } else if (displayName.length > PROFILE_LIMITS.displayNameMax) {
    errors.displayName = `Ime je lahko dolgo največ ${PROFILE_LIMITS.displayNameMax} znakov.`;
  }
  if (faculty.length > PROFILE_LIMITS.facultyMax) {
    errors.faculty = `Fakulteta je lahko dolga največ ${PROFILE_LIMITS.facultyMax} znakov.`;
  }
  if (bio.length > PROFILE_LIMITS.bioMax) {
    errors.bio = `Opis je lahko dolg največ ${PROFILE_LIMITS.bioMax} znakov.`;
  }

  let age: number | null = null;
  if (ageText) {
    age = /^\d+$/.test(ageText) ? Number(ageText) : Number.NaN;
    if (
      !Number.isInteger(age) ||
      age < PROFILE_LIMITS.ageMin ||
      age > PROFILE_LIMITS.ageMax
    ) {
      errors.age = `Starost mora biti celo število med ${PROFILE_LIMITS.ageMin} in ${PROFILE_LIMITS.ageMax}.`;
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, values: { display_name: displayName, faculty, age, bio } };
}

type QueryError = { code?: string; message?: string; status?: number } | null;

/** Minimal structural client so the profile queries can be tested without Supabase. */
export type ProfileClient = {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string } | null };
      error: QueryError;
    }>;
  };
  from: (table: "profiles") => {
    select: (columns: string) => {
      eq: (
        column: "id",
        value: string,
      ) => {
        maybeSingle: () => PromiseLike<{
          data: ProfileRow | null;
          error: QueryError;
        }>;
      };
    };
    update: (values: EditableProfile | Pick<ProfileRow, "is_available">) => {
      eq: (
        column: "id",
        value: string,
      ) => {
        select: (columns: string) => {
          maybeSingle: () => PromiseLike<{
            data: ProfileRow | null;
            error: QueryError;
          }>;
        };
      };
    };
  };
};

export type OwnProfileResult =
  | { status: "signed-out" }
  | { status: "missing"; userId: string }
  | { status: "ready"; userId: string; profile: Profile };

export class ProfileRequestError extends Error {
  constructor(
    public readonly kind: "permission" | "offline" | "unknown",
    message: string,
  ) {
    super(message);
    this.name = "ProfileRequestError";
  }
}

export const profileErrorMessages = {
  permission: "Nimaš dovoljenja za ta profil. Odjavi se in se prijavi znova.",
  offline: "Ni povezave. Preveri internet in poskusi znova.",
  unknown: "Profila ni bilo mogoče naložiti ali shraniti. Poskusi znova.",
} as const;

export function toProfileRequestError(error: unknown): ProfileRequestError {
  if (error instanceof ProfileRequestError) return error;
  const details = (error ?? {}) as {
    code?: string;
    status?: number;
    message?: string;
  };
  if (
    details.code === "42501" ||
    details.code === "PGRST301" ||
    details.status === 401 ||
    details.status === 403
  ) {
    return new ProfileRequestError(
      "permission",
      profileErrorMessages.permission,
    );
  }
  if (
    error instanceof TypeError ||
    /fetch|network/i.test(details.message ?? "")
  ) {
    return new ProfileRequestError("offline", profileErrorMessages.offline);
  }
  return new ProfileRequestError("unknown", profileErrorMessages.unknown);
}

export async function fetchOwnProfile(
  client: ProfileClient,
): Promise<OwnProfileResult> {
  try {
    const { data: userData, error: userError } = await client.auth.getUser();
    const user = userData.user;
    if (!user) {
      // A missing or expired session is a signed-out state, not a failure.
      if (userError && userError.status !== 401 && userError.status !== 400) {
        throw userError;
      }
      return { status: "signed-out" };
    }

    const { data, error } = await client
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { status: "missing", userId: user.id };
    return { status: "ready", userId: user.id, profile: mapProfile(data) };
  } catch (error) {
    throw toProfileRequestError(error);
  }
}

export async function updateOwnProfile(
  client: ProfileClient,
  userId: string,
  values: EditableProfile,
): Promise<Profile> {
  try {
    const { data, error } = await client
      .from("profiles")
      .update({
        display_name: values.display_name,
        faculty: values.faculty,
        age: values.age,
        bio: values.bio,
      })
      .eq("id", userId)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    // RLS hides rows the user may not update, which returns no row instead of an error.
    if (!data)
      throw new ProfileRequestError(
        "permission",
        profileErrorMessages.permission,
      );
    return mapProfile(data);
  } catch (error) {
    throw toProfileRequestError(error);
  }
}

/**
 * Saves "Iščem sostanovalca / sobo" (Android `setAvailability`). Only available
 * profiles appear among recommendations.
 */
export async function updateAvailability(
  client: ProfileClient,
  userId: string,
  isAvailable: boolean,
): Promise<Profile> {
  try {
    const { data, error } = await client
      .from("profiles")
      .update({ is_available: isAvailable })
      .eq("id", userId)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data)
      throw new ProfileRequestError(
        "permission",
        profileErrorMessages.permission,
      );
    return mapProfile(data);
  } catch (error) {
    throw toProfileRequestError(error);
  }
}

export function initialsFor(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}
