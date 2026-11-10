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

/** Keys of `m.profile.validation`; the limits come from `PROFILE_LIMITS`. */
export type ProfileFieldError =
  | "display-name-short"
  | "display-name-long"
  | "faculty-long"
  | "bio-long"
  | "age-range";

export type ProfileValidation =
  | { ok: true; values: EditableProfile }
  | { ok: false; errors: Partial<Record<ProfileField, ProfileFieldError>> };

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
  const errors: Partial<Record<ProfileField, ProfileFieldError>> = {};
  const displayName = draft.displayName.trim().replace(/\s+/g, " ");
  const faculty = draft.faculty.trim();
  const bio = draft.bio.trim();
  const ageText = draft.age.trim();

  if (displayName.length < PROFILE_LIMITS.displayNameMin) {
    errors.displayName = "display-name-short";
  } else if (displayName.length > PROFILE_LIMITS.displayNameMax) {
    errors.displayName = "display-name-long";
  }
  if (faculty.length > PROFILE_LIMITS.facultyMax) {
    errors.faculty = "faculty-long";
  }
  if (bio.length > PROFILE_LIMITS.bioMax) {
    errors.bio = "bio-long";
  }

  let age: number | null = null;
  if (ageText) {
    age = /^\d+$/.test(ageText) ? Number(ageText) : Number.NaN;
    if (
      !Number.isInteger(age) ||
      age < PROFILE_LIMITS.ageMin ||
      age > PROFILE_LIMITS.ageMax
    ) {
      errors.age = "age-range";
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

/** Keys of `m.profile.errors`. */
export type ProfileErrorKind = "permission" | "offline" | "unknown";

export class ProfileRequestError extends Error {
  constructor(public readonly kind: ProfileErrorKind) {
    // The text shown is m.profile.errors[kind]; the message is for logs.
    super(`Profile request failed: ${kind}`);
    this.name = "ProfileRequestError";
  }
}

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
    return new ProfileRequestError("permission");
  }
  if (
    error instanceof TypeError ||
    /fetch|network/i.test(details.message ?? "")
  ) {
    return new ProfileRequestError("offline");
  }
  return new ProfileRequestError("unknown");
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
    if (!data) throw new ProfileRequestError("permission");
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
    if (!data) throw new ProfileRequestError("permission");
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
