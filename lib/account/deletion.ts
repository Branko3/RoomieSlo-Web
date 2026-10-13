import {
  DELETION_PHRASE,
  isConfirmationValid,
  type DeletionOutcome,
} from "../../supabase/functions/_shared/account-deletion";

export {
  DELETION_PHRASE,
  isConfirmationValid,
} from "../../supabase/functions/_shared/account-deletion";

type AuthError = { message?: string; status?: number; code?: string } | null;

/** Structural subset of the Supabase client used to delete one's own account. */
export type DeleteAccountClient = {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string; email?: string } | null };
      error: AuthError;
    }>;
    signInWithPassword: (credentials: {
      email: string;
      password: string;
    }) => Promise<{ error: AuthError }>;
  };
  functions: {
    invoke: (
      name: "delete-account",
      options: { body: { confirm: string } },
    ) => Promise<{ data: unknown; error: unknown }>;
  };
};

export type DeleteAccountFailure =
  | "invalid-confirmation"
  | "missing-password"
  | "wrong-password"
  | "signed-out"
  | "reauth"
  | "partial"
  | "offline"
  | "failed";

export type DeleteAccountResult =
  { ok: true } | { ok: false; kind: DeleteAccountFailure; message: string };

export const deletionCopy: Record<DeleteAccountFailure, string> = {
  "invalid-confirmation": `Za potrditev vpiši »${DELETION_PHRASE}«.`,
  "missing-password": "Vnesi geslo.",
  "wrong-password": "Geslo ni pravilno.",
  "signed-out": "Seja je potekla. Prijavi se znova in poskusi še enkrat.",
  reauth: "Za izbris se moraš znova prijaviti. Vnesi geslo in poskusi znova.",
  partial:
    "Izbris ni bil dokončan. Tvoji podatki niso bili izbrisani v celoti; piši nam, da ga dokončamo.",
  offline: "Ni povezave. Poskusi znova.",
  failed: "Računa ni bilo mogoče izbrisati. Poskusi znova.",
};

function fail(kind: DeleteAccountFailure): DeleteAccountResult {
  return { ok: false, kind, message: deletionCopy[kind] };
}

function isNetworkError(error: unknown): boolean {
  const name = (error as { name?: string } | null)?.name ?? "";
  const message = (error as { message?: string } | null)?.message ?? "";
  return (
    error instanceof TypeError ||
    name === "FunctionsFetchError" ||
    /fetch|network/i.test(message)
  );
}

/** Maps the function's HTTP status and outcome to the result the page shows. */
export function resultFromResponse(
  status: number,
  outcome?: DeletionOutcome | string,
): DeleteAccountResult {
  if (status === 200 || status === 410) return { ok: true };
  if (status === 400) return fail("invalid-confirmation");
  if (status === 401)
    return fail(outcome === "session_expired" ? "signed-out" : "reauth");
  if (status === 500) return fail("partial");
  return fail("failed");
}

/** Reads status and outcome from a non-2xx `functions.invoke` error (FunctionsHttpError). */
async function fromInvokeError(error: unknown): Promise<DeleteAccountResult> {
  const response = (error as { context?: Response } | null)?.context;
  if (response && typeof response.status === "number") {
    let outcome: string | undefined;
    try {
      outcome = ((await response.clone().json()) as { outcome?: string })
        .outcome;
    } catch {
      outcome = undefined;
    }
    return resultFromResponse(response.status, outcome);
  }
  return fail(isNetworkError(error) ? "offline" : "failed");
}

/**
 * Deletes the signed-in user's account. A wrong confirmation phrase or an empty
 * password sends nothing. The password sign-in refreshes `last_sign_in_at`,
 * which the function requires to be under 10 minutes old; the function itself
 * takes the user only from the session token.
 */
export async function deleteOwnAccount(
  client: DeleteAccountClient,
  input: { password: string; confirm: string },
): Promise<DeleteAccountResult> {
  if (!isConfirmationValid(input.confirm)) return fail("invalid-confirmation");
  if (!input.password) return fail("missing-password");
  try {
    const { data } = await client.auth.getUser();
    const email = data.user?.email;
    if (!email) return fail("signed-out");

    const signIn = await client.auth.signInWithPassword({
      email,
      password: input.password,
    });
    if (signIn.error) {
      return isNetworkError(signIn.error)
        ? fail("offline")
        : fail("wrong-password");
    }

    const { error } = await client.functions.invoke("delete-account", {
      body: { confirm: input.confirm.trim() },
    });
    if (error) return await fromInvokeError(error);
    return { ok: true };
  } catch (error) {
    return fail(isNetworkError(error) ? "offline" : "failed");
  }
}
