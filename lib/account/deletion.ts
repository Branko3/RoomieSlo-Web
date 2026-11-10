import type { Locale } from "../i18n/config";
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

/** The page shows `m.account.deletion.errors[kind]`. */
export type DeleteAccountResult =
  { ok: true } | { ok: false; kind: DeleteAccountFailure };

/**
 * The phrase the user types to confirm, per interface language. The
 * `delete-account` function only accepts the canonical Slovenian
 * DELETION_PHRASE, so English input is checked here and replaced with it.
 */
export const CONFIRMATION_PHRASES: Record<Locale, string> = {
  sl: DELETION_PHRASE,
  en: "DELETE",
};

/** The value to send to the function, or null when `input` is not the locale's phrase. */
export function canonicalConfirmation(
  input: string,
  locale: Locale,
): string | null {
  if (locale === "sl") {
    // Unchanged Slovenian behaviour: the function re-checks the typed text.
    return isConfirmationValid(input) ? input.trim() : null;
  }
  return input.trim().toUpperCase() === CONFIRMATION_PHRASES[locale]
    ? DELETION_PHRASE
    : null;
}

function fail(kind: DeleteAccountFailure): DeleteAccountResult {
  return { ok: false, kind };
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
 * Deletes the signed-in user's account. A wrong confirmation phrase (see
 * CONFIRMATION_PHRASES) or an empty password sends nothing; English "DELETE"
 * is sent as the canonical phrase. The password sign-in refreshes `last_sign_in_at`,
 * which the function requires to be under 10 minutes old; the function itself
 * takes the user only from the session token.
 */
export async function deleteOwnAccount(
  client: DeleteAccountClient,
  input: { password: string; confirm: string; locale?: Locale },
): Promise<DeleteAccountResult> {
  const confirm = canonicalConfirmation(input.confirm, input.locale ?? "sl");
  if (confirm === null) return fail("invalid-confirmation");
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
      body: { confirm },
    });
    if (error) return await fromInvokeError(error);
    return { ok: true };
  } catch (error) {
    return fail(isNetworkError(error) ? "offline" : "failed");
  }
}
