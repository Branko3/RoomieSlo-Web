// Account-deletion rules shared by the `delete-account` Edge Function (Deno) and
// the web app (Node/browser). Keep this file free of imports so both runtimes
// can load it as is. Policy: docs/features/account-document-deletion-retention-rules.md.

/** What the user types to confirm; compared case-insensitively after trimming. */
export const DELETION_PHRASE = "IZBRIŠI";

/** A password sign-in must be at most this old (approved: 10 minutes). */
export const REAUTH_WINDOW_MS = 10 * 60 * 1000;

/** Private bucket holding academic documents under `<uid>/`. */
export const DOCUMENT_BUCKET = "vpisnice";

export type DeletionOutcome =
  | "deleted"
  | "already_deleted"
  | "invalid_confirmation"
  | "reauth_required"
  | "session_expired"
  | "partial_failure"
  | "method_not_allowed";

const STATUS: Record<DeletionOutcome, number> = {
  deleted: 200,
  already_deleted: 410,
  invalid_confirmation: 400,
  reauth_required: 401,
  session_expired: 401,
  partial_failure: 500,
  method_not_allowed: 405,
};

export function statusFor(outcome: DeletionOutcome): number {
  return STATUS[outcome];
}

export function isConfirmationValid(input: unknown): boolean {
  return (
    typeof input === "string" &&
    input.trim().toLocaleUpperCase("sl") === DELETION_PHRASE
  );
}

/** True when the last sign-in happened within the re-authentication window. */
export function isRecentSignIn(
  lastSignInAt: string | null | undefined,
  now: number,
): boolean {
  if (!lastSignInAt) return false;
  const signedInAt = Date.parse(lastSignInAt);
  if (Number.isNaN(signedInAt)) return false;
  // A small allowance for clock skew between Auth and the function.
  return signedInAt <= now + 60_000 && now - signedInAt <= REAUTH_WINDOW_MS;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The user's document folder. Refuses anything but a UUID so no other path can be built. */
export function documentFolder(userId: string): string {
  if (!UUID.test(userId)) throw new Error("invalid user id");
  return userId;
}

/** Full object paths for names listed inside the user's folder. */
export function documentPaths(
  userId: string,
  names: readonly string[],
): string[] {
  const folder = documentFolder(userId);
  return names
    .filter((name) => name && !name.includes("/") && name !== "..")
    .map((name) => `${folder}/${name}`);
}

/** Supabase Auth reports a token whose user no longer exists. */
export function isMissingUserError(
  error: { status?: number; code?: string; message?: string } | null,
): boolean {
  if (!error) return false;
  return (
    error.code === "user_not_found" ||
    error.status === 404 ||
    /user .*(not found|does not exist)/i.test(error.message ?? "")
  );
}

/** Redacted operational log line: never the user id, e-mail, token or file names. */
export function logLine(
  outcome: DeletionOutcome,
  requestId: string,
  detail?: string,
): string {
  return JSON.stringify({
    event: "account_deletion",
    outcome,
    request_id: requestId,
    ...(detail ? { detail } : {}),
  });
}
