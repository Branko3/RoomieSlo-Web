import type { CompatibilityAnswer } from "../compatibility/compatibility";

type DbError = { code?: string; message?: string; status?: number } | null;

/** A recommended person as the server returns it: no questionnaire answers. */
export type RecommendedProfile = {
  id: string;
  displayName: string;
  verified: boolean;
  available: boolean;
  age: number | null;
  faculty: string;
  bio: string;
};

export type Recommendation = {
  profile: RecommendedProfile;
  compatibility: number;
  /** Statements both people answered; 0 means no score could be computed. */
  sharedStatements: number;
};

export type RecommendationsResult = {
  /** The signed-in user's own answers (for the "answer more" empty state). */
  myAnswers: CompatibilityAnswer[];
  recommendations: Recommendation[];
};

/** Structural subset of the Supabase client used for recommendations. */
export type RecommendationsClient = {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string } | null };
      error: DbError;
    }>;
  };
  functions: {
    invoke: (
      name: "recommendations",
      options?: { body?: unknown },
    ) => Promise<{ data: unknown; error: unknown }>;
  };
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

/** "Ana K., 22", or the name alone when no age is set (Android `imeInStarost`). */
export function nameAndAge(
  profile: Pick<RecommendedProfile, "displayName" | "age">,
): string {
  return profile.age === null
    ? profile.displayName
    : `${profile.displayName}, ${profile.age}`;
}

function isResult(value: unknown): value is RecommendationsResult {
  const v = value as RecommendationsResult | null;
  return (
    !!v &&
    Array.isArray(v.myAnswers) &&
    Array.isArray(v.recommendations) &&
    v.recommendations.every(
      (r) =>
        typeof r?.profile?.id === "string" &&
        typeof r.compatibility === "number" &&
        typeof r.sharedStatements === "number",
    )
  );
}

function toError(error: unknown): RecommendationsError {
  const e = error as {
    name?: string;
    message?: string;
    context?: { status?: number };
  } | null;
  if (e?.context?.status === 401) return new RecommendationsError("signed-out");
  if (
    error instanceof TypeError ||
    e?.name === "FunctionsFetchError" ||
    /fetch|network/i.test(e?.message ?? "")
  )
    return new RecommendationsError("offline");
  return new RecommendationsError("unknown");
}

/**
 * Loads available profiles ranked by compatibility with the user's answers
 * (Android `RecommendedProfilesViewModel.load`). The ranking runs in the
 * `recommendations` Edge Function, because other people's answers are not
 * readable from the browser.
 */
export async function loadRecommendations(
  client: RecommendationsClient,
): Promise<RecommendationsResult> {
  try {
    const { data: userData } = await client.auth.getUser();
    if (!userData.user?.id) throw new RecommendationsError("signed-out");
    const { data, error } = await client.functions.invoke("recommendations");
    if (error) throw toError(error);
    if (!isResult(data)) throw new RecommendationsError("unknown");
    return data;
  } catch (error) {
    if (error instanceof RecommendationsError) throw error;
    throw toError(error);
  }
}
