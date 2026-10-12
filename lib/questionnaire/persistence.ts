import {
  answersFromStored,
  rowsForSave,
  type AnswerRow,
  type Answers,
  type StoredAnswer,
} from "./model";

type DbError = { code?: string; message?: string; status?: number } | null;

/** Structural subset of the Supabase client used by the questionnaire. */
export type QuestionnaireClient = {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string } | null };
      error: DbError;
    }>;
  };
  from: (table: "questionnaire_answers") => {
    select: (columns: string) => {
      eq: (
        column: "profile_id",
        value: string,
      ) => PromiseLike<{ data: StoredAnswer[] | null; error: DbError }>;
    };
    upsert: (
      rows: AnswerRow[],
      options: { onConflict: string },
    ) => PromiseLike<{ error: DbError }>;
  };
};

export type QuestionnaireErrorKind =
  "signed-out" | "permission" | "offline" | "unknown";

export const questionnaireErrorMessages: Record<
  QuestionnaireErrorKind,
  string
> = {
  "signed-out": "Za izpolnjevanje vprašalnika se moraš prijaviti.",
  permission:
    "Nimaš dovoljenja za shranjevanje teh odgovorov. Prijavi se znova.",
  offline: "Ni povezave. Preveri internet in poskusi znova.",
  unknown: "Shranjevanje ni uspelo. Poskusi znova.",
};

export class QuestionnaireError extends Error {
  constructor(public readonly kind: QuestionnaireErrorKind) {
    super(questionnaireErrorMessages[kind]);
    this.name = "QuestionnaireError";
  }
}

export function toQuestionnaireError(error: unknown): QuestionnaireError {
  if (error instanceof QuestionnaireError) return error;
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
    return new QuestionnaireError("permission");
  }
  if (
    error instanceof TypeError ||
    /fetch|network/i.test(details.message ?? "")
  ) {
    return new QuestionnaireError("offline");
  }
  return new QuestionnaireError("unknown");
}

async function currentUserId(client: QuestionnaireClient): Promise<string> {
  const { data } = await client.auth.getUser();
  if (!data.user) throw new QuestionnaireError("signed-out");
  return data.user.id;
}

export async function loadMyAnswers(
  client: QuestionnaireClient,
): Promise<{ userId: string; answers: Answers }> {
  try {
    const userId = await currentUserId(client);
    const { data, error } = await client
      .from("questionnaire_answers")
      .select("question_id,value,weight")
      .eq("profile_id", userId);
    if (error) throw error;
    return { userId, answers: answersFromStored(data ?? []) };
  } catch (error) {
    throw toQuestionnaireError(error);
  }
}

/** Saves a row for every statement in one upsert; skipping saves the same way. */
export async function saveMyAnswers(
  client: QuestionnaireClient,
  userId: string,
  answers: Answers,
): Promise<void> {
  try {
    const { error } = await client
      .from("questionnaire_answers")
      .upsert(rowsForSave(userId, answers), {
        onConflict: "profile_id,question_id",
      });
    if (error) throw error;
  } catch (error) {
    throw toQuestionnaireError(error);
  }
}

/** Android returns to the profile when opened from it, otherwise onboarding ends at listings. */
export function destinationAfterSave(from: string | null): string {
  return from === "onboarding" ? "/listings" : "/profile";
}
