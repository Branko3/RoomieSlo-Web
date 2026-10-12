import {
  rankByCompatibility,
  type CompatibilityAnswer,
} from "../compatibility/compatibility";

type DbError = { code?: string; message?: string; status?: number } | null;

/** Android `PROFILE_WITH_ANSWERS`: profile fields plus nested questionnaire answers. */
export const PROFILE_WITH_ANSWERS =
  "id,display_name,academic_status_verified,is_available,age,faculty,bio,avatar_url,questionnaire_answers(profile_id,question_id,value,weight)";

type ProfileWithAnswersRow = {
  id: string;
  display_name: string | null;
  academic_status_verified: boolean;
  is_available: boolean;
  age: number | null;
  faculty: string | null;
  bio: string | null;
  avatar_url: string | null;
  questionnaire_answers: CompatibilityAnswer[] | null;
};

export type RecommendedProfile = {
  id: string;
  displayName: string;
  verified: boolean;
  available: boolean;
  age: number | null;
  faculty: string;
  bio: string;
  answers: CompatibilityAnswer[];
};

export type Recommendation = {
  profile: RecommendedProfile;
  compatibility: number;
};

type Filterable = PromiseLike<{
  data: ProfileWithAnswersRow[] | null;
  error: DbError;
}> & {
  eq: (column: string, value: unknown) => Filterable;
  neq: (column: string, value: unknown) => Filterable;
};

/** Structural subset of the Supabase client used for recommendations. */
export type RecommendationsClient = {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string } | null };
      error: DbError;
    }>;
  };
  from: (table: "profiles") => { select: (columns: string) => Filterable };
};

export class RecommendationsError extends Error {
  constructor(public readonly kind: "signed-out" | "offline" | "unknown") {
    super(
      kind === "signed-out"
        ? "Za priporočila se moraš prijaviti."
        : kind === "offline"
          ? "Ni povezave. Priporočil ni bilo mogoče naložiti."
          : "Napaka pri nalaganju priporočil.",
    );
    this.name = "RecommendationsError";
  }
}

function toProfile(row: ProfileWithAnswersRow): RecommendedProfile {
  return {
    id: row.id,
    displayName: row.display_name?.trim() || "Uporabnik",
    verified: row.academic_status_verified === true,
    available: row.is_available === true,
    age: row.age,
    faculty: row.faculty ?? "",
    bio: row.bio ?? "",
    answers: row.questionnaire_answers ?? [],
  };
}

/** "Ana K., 22", or the name alone when no age is set (Android `imeInStarost`). */
export function nameAndAge(
  profile: Pick<RecommendedProfile, "displayName" | "age">,
): string {
  return profile.age === null
    ? profile.displayName
    : `${profile.displayName}, ${profile.age}`;
}

/**
 * Loads available profiles other than the current user with their answers in
 * one request, scores them against the user's own answers, and orders them by
 * descending compatibility (Android `RecommendedProfilesViewModel.load`).
 */
export async function loadRecommendations(
  client: RecommendationsClient,
): Promise<{
  myAnswers: CompatibilityAnswer[] | null;
  recommendations: Recommendation[];
}> {
  try {
    const { data: userData } = await client.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) throw new RecommendationsError("signed-out");

    const [mine, candidates] = await Promise.all([
      client.from("profiles").select(PROFILE_WITH_ANSWERS).eq("id", userId),
      client
        .from("profiles")
        .select(PROFILE_WITH_ANSWERS)
        .eq("is_available", true)
        .neq("id", userId),
    ]);
    if (mine.error) throw mine.error;
    if (candidates.error) throw candidates.error;

    const myRow = mine.data?.[0];
    const myAnswers = myRow ? (myRow.questionnaire_answers ?? []) : null;
    const ranked = rankByCompatibility(
      myAnswers,
      (candidates.data ?? []).map(toProfile),
    );
    return {
      myAnswers,
      recommendations: ranked.map(({ candidate, compatibility }) => ({
        profile: candidate,
        compatibility,
      })),
    };
  } catch (error) {
    if (error instanceof RecommendationsError) throw error;
    const message = (error as { message?: string } | null)?.message ?? "";
    throw new RecommendationsError(
      error instanceof TypeError || /fetch|network/i.test(message)
        ? "offline"
        : "unknown",
    );
  }
}
