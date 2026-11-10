import { getSafeReturnPath } from "./routes";

/** Sign-in failures; the page shows `m.auth.login.errors[code]`. */
export type LoginError =
  | "invalid_email"
  | "missing_password"
  | "invalid_credentials"
  | "email_not_confirmed"
  | "network"
  | "failed"
  | "unreachable";

// Same-origin check shared with the middleware and AuthProvider redirects.
export function safeDestination(value: string | null) {
  return getSafeReturnPath(value);
}

/** Maps a Supabase sign-in error message to a code, never exposing the raw text. */
export function loginErrorCode(message: string): LoginError {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) {
    return "invalid_credentials";
  }
  if (normalized.includes("email not confirmed")) {
    return "email_not_confirmed";
  }
  if (normalized.includes("network") || normalized.includes("fetch")) {
    return "network";
  }
  return "failed";
}

export function validateLogin(
  email: string,
  password: string,
): { email: string; error: LoginError | null } {
  const normalizedEmail = email.trim();
  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return { email: normalizedEmail, error: "invalid_email" };
  }
  if (!password) return { email: normalizedEmail, error: "missing_password" };
  return { email: normalizedEmail, error: null };
}

export async function submitLogin({
  email,
  password,
  pending,
  destination,
  signIn,
  onError,
  onSuccess,
}: {
  email: string;
  password: string;
  pending: boolean;
  destination: string | null;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ error: { message: string } | null }>;
  onError: (error: LoginError) => void;
  onSuccess: (destination: string) => void;
}) {
  if (pending) return false;
  const validation = validateLogin(email, password);
  if (validation.error) {
    onError(validation.error);
    return false;
  }
  try {
    const result = await signIn(validation.email, password);
    if (result.error) {
      onError(loginErrorCode(result.error.message));
    } else {
      onSuccess(safeDestination(destination));
    }
  } catch {
    onError("unreachable");
  }
  return true;
}
