import type { Cohabitation } from "../cohabitation/cohabitation";
import { ratingAction } from "./rules";
import { parseMyRatingSummary, type MyRatingSummary } from "./summary";
import {
  IMPROVEMENT_TAGS,
  inTagOrder,
  isImprovementTag,
  isStrengthTag,
  STRENGTH_TAGS,
  tagProblem,
  type ImprovementTag,
  type StrengthTag,
} from "./tags";

/**
 * Roommate ratings: my own rating of a cohabitant (RLS shows raters only their
 * own rows), submitting it through `submit_roommate_rating`, my aggregate from
 * `my_rating_summary`, and the "Prikaži ocene sostanovalcev" setting.
 */

type DbError = { code?: string; message?: string; status?: number } | null;
type Thenable<T> = PromiseLike<{ data: T | null; error: DbError }>;

export type MyRating = {
  id: string;
  cohabitationId: string;
  ratedId: string;
  wouldLiveAgain: boolean;
  strengths: StrengthTag[];
  improvements: ImprovementTag[];
  status: "hidden" | "revealed";
  submittedAt: string;
  revealedAt: string | null;
  updatedAt: string;
};

export type RatingAnswers = {
  wouldLiveAgain: boolean | null;
  strengths: StrengthTag[];
  improvements: ImprovementTag[];
};

export const RATING_COLUMNS =
  "id,cohabitation_id,rated_id,would_live_again,strengths,improvements,status,submitted_at,revealed_at,updated_at";

/** Structural subset of the Supabase client used for ratings. */
export type RatingClient = {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string } | null };
      error: DbError;
    }>;
  };
  from(table: "roommate_ratings"): {
    select: (columns: string) => {
      eq: (
        column: "cohabitation_id",
        value: string,
      ) => { maybeSingle: () => Thenable<unknown> };
    };
  };
  from(table: "profiles"): {
    update: (values: { show_roommate_ratings: boolean }) => {
      eq: (
        column: "id",
        value: string,
      ) => {
        select: (columns: "show_roommate_ratings") => {
          maybeSingle: () => Thenable<{ show_roommate_ratings: boolean }>;
        };
      };
    };
  };
  rpc(
    fn: "submit_roommate_rating",
    args: {
      p_cohabitation_id: string;
      p_would_live_again: boolean;
      p_strengths: string[];
      p_improvements: string[];
    },
  ): Thenable<unknown>;
  rpc(fn: "my_rating_summary"): Thenable<unknown>;
};

export type RatingErrorKind =
  | "signed-out"
  | "permission"
  | "offline"
  | "invalid"
  | "window"
  | "locked"
  | "unknown";

export const ratingMessages: Record<RatingErrorKind, string> = {
  "signed-out": "Za to dejanje se prijavi.",
  permission: "Te osebe zdaj ne moreš oceniti.",
  offline: "Ni povezave. Preveri internet in poskusi znova.",
  invalid:
    "Odgovori na vprašanje Da/Ne in izberi največ 3 oznake v vsakem sklopu.",
  window: "Ocenjevanje za to sobivanje trenutno ni odprto.",
  locked: "Oceno lahko posodobiš šele 6 mesecev po zadnji oddaji.",
  unknown: "Ocene ni bilo mogoče shraniti. Poskusi znova.",
};

export const ratingLoadMessage = "Ocen ni bilo mogoče naložiti.";

export class RatingError extends Error {
  constructor(
    public readonly kind: RatingErrorKind,
    message: string = ratingMessages[kind],
  ) {
    super(message);
    this.name = "RatingError";
  }
}

/**
 * The RPC raises 42501 for authorization, 22023 for invalid answers, and P0001
 * for the window ("not open yet", "has closed") and the 6-month update rule.
 */
export function toRatingError(error: unknown): RatingError {
  if (error instanceof RatingError) return error;
  const {
    code,
    message = "",
    status,
  } = (error ?? {}) as {
    code?: string;
    message?: string;
    status?: number;
  };
  if (error instanceof TypeError || /fetch|network/i.test(message))
    return new RatingError("offline");
  if (
    status === 401 ||
    code === "PGRST301" ||
    /not signed in|jwt/i.test(message)
  )
    return new RatingError("signed-out");
  if (
    code === "42501" ||
    status === 403 ||
    /permission denied|row-level security/i.test(message)
  )
    return new RatingError("permission");
  if (code === "22023") return new RatingError("invalid");
  if (/cannot be updated/i.test(message)) return new RatingError("locked");
  if (/window/i.test(message)) return new RatingError("window");
  return new RatingError("unknown");
}

/** What a failed load shows. */
export function ratingLoadFailure(error: unknown): string {
  return error instanceof RatingError &&
    (error.kind === "signed-out" ||
      error.kind === "offline" ||
      error.kind === "permission")
    ? error.message
    : ratingLoadMessage;
}

const text = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

/** Validates my rating row; anything unexpected is an unknown error. */
export function parseMyRating(row: unknown): MyRating {
  const r = (row ?? {}) as Record<string, unknown>;
  const valid =
    typeof row === "object" &&
    row !== null &&
    text(r.id) &&
    text(r.cohabitation_id) &&
    text(r.rated_id) &&
    typeof r.would_live_again === "boolean" &&
    Array.isArray(r.strengths) &&
    r.strengths.every(isStrengthTag) &&
    Array.isArray(r.improvements) &&
    r.improvements.every(isImprovementTag) &&
    (r.status === "hidden" || r.status === "revealed") &&
    text(r.submitted_at) &&
    (r.revealed_at === null ||
      r.revealed_at === undefined ||
      text(r.revealed_at)) &&
    text(r.updated_at);
  if (!valid) throw new RatingError("unknown");
  return {
    id: r.id as string,
    cohabitationId: r.cohabitation_id as string,
    ratedId: r.rated_id as string,
    wouldLiveAgain: r.would_live_again as boolean,
    strengths: r.strengths as StrengthTag[],
    improvements: r.improvements as ImprovementTag[],
    status: r.status as MyRating["status"],
    submittedAt: r.submitted_at as string,
    revealedAt: (r.revealed_at as string | null | undefined) ?? null,
    updatedAt: r.updated_at as string,
  };
}

/** Mirrors the server's answer checks. */
export function answersProblem(answers: RatingAnswers): boolean {
  return (
    typeof answers.wouldLiveAgain !== "boolean" ||
    tagProblem(answers.strengths, STRENGTH_TAGS) !== null ||
    tagProblem(answers.improvements, IMPROVEMENT_TAGS) !== null
  );
}

async function me(client: RatingClient): Promise<string> {
  const { data } = await client.auth.getUser();
  if (!data.user) throw new RatingError("signed-out");
  return data.user.id;
}

/** My rating for one cohabitation, if I gave one. */
export async function loadMyRating(
  client: RatingClient,
  cohabitationId: string,
): Promise<MyRating | null> {
  try {
    await me(client);
    const { data, error } = await client
      .from("roommate_ratings")
      .select(RATING_COLUMNS)
      .eq("cohabitation_id", cohabitationId)
      .maybeSingle();
    if (error) throw error;
    return data ? parseMyRating(data) : null;
  } catch (error) {
    throw toRatingError(error);
  }
}

/** Submits or updates my rating, after the same checks the server makes. */
export async function submitRating(
  client: RatingClient,
  cohabitation: Pick<
    Cohabitation,
    "id" | "status" | "startedMonth" | "endedAt" | "confirmedAt"
  >,
  answers: RatingAnswers,
  mine: MyRating | null,
  now: Date = new Date(),
): Promise<MyRating> {
  if (answersProblem(answers)) throw new RatingError("invalid");
  const action = ratingAction(cohabitation, mine, now);
  if (action.kind === "unavailable") throw new RatingError("window");
  if (action.kind === "locked") throw new RatingError("locked");
  try {
    const { data, error } = await client.rpc("submit_roommate_rating", {
      p_cohabitation_id: cohabitation.id,
      p_would_live_again: answers.wouldLiveAgain as boolean,
      p_strengths: inTagOrder(answers.strengths, STRENGTH_TAGS),
      p_improvements: inTagOrder(answers.improvements, IMPROVEMENT_TAGS),
    });
    if (error) throw error;
    return parseMyRating(data);
  } catch (error) {
    throw toRatingError(error);
  }
}

/** My own aggregate (improvements included; never who said what). */
export async function loadMySummary(
  client: RatingClient,
): Promise<MyRatingSummary> {
  try {
    await me(client);
    const { data, error } = await client.rpc("my_rating_summary");
    if (error) throw error;
    const summary = parseMyRatingSummary(data);
    if (!summary) throw new RatingError("unknown");
    return summary;
  } catch (error) {
    throw toRatingError(error);
  }
}

/** "Prikaži ocene sostanovalcev": saves the setting on my profile. */
export async function setRatingsVisible(
  client: RatingClient,
  visible: boolean,
): Promise<boolean> {
  try {
    const myId = await me(client);
    const { data, error } = await client
      .from("profiles")
      .update({ show_roommate_ratings: visible })
      .eq("id", myId)
      .select("show_roommate_ratings")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new RatingError("permission");
    return data.show_roommate_ratings;
  } catch (error) {
    throw toRatingError(error);
  }
}

/** The cohabitation a chat's rating refers to: the latest confirmed one. */
export function ratableCohabitation(
  cohabitations: Cohabitation[],
): Cohabitation | null {
  return (
    [...cohabitations]
      .filter(
        (c) =>
          (c.status === "active" || c.status === "ended") &&
          c.confirmedAt !== null,
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
  );
}
