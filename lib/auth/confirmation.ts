import type { EmailOtpType } from "@supabase/supabase-js";

export const CONFIRM_ROUTE = "/auth/confirm";
export const CONFIRMATION_PAGE = "/auth/confirmation";
export const DEFAULT_AFTER_CONFIRM = "/listings";
export const RESEND_COOLDOWN_SECONDS = 60;

const ALLOWED_OTP_TYPES: EmailOtpType[] = ["signup", "email", "email_change"];

export type ConfirmationError = "missing" | "expired" | "invalid" | "unknown";

export type ConfirmationRequest =
  | { kind: "otp"; tokenHash: string; type: EmailOtpType; next: string }
  | { kind: "code"; code: string; next: string }
  | { kind: "error"; error: ConfirmationError; next: string };

export const confirmationErrorMessages: Record<ConfirmationError, string> = {
  missing:
    "Potrditvena povezava ni popolna. Odpri povezavo iz zadnjega e-sporočila ali pošlji novo.",
  expired:
    "Potrditvena povezava je potekla. Pošlji novo potrditveno e-sporočilo.",
  invalid:
    "Potrditvena povezava ni veljavna ali je bila že uporabljena. Poskusi se prijaviti ali pošlji novo.",
  unknown:
    "E-naslova trenutno ni bilo mogoče potrditi. Poskusi znova čez nekaj minut.",
};

/** Accepts only same-origin relative paths so the link cannot redirect off-site. */
export function safeNextPath(next: string | null | undefined): string {
  if (
    !next ||
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.includes("\\")
  ) {
    return DEFAULT_AFTER_CONFIRM;
  }
  if (next.startsWith(CONFIRM_ROUTE)) return DEFAULT_AFTER_CONFIRM;
  return next;
}

export function parseConfirmationParams(
  params: URLSearchParams,
): ConfirmationRequest {
  const next = safeNextPath(params.get("next"));
  const providerError = params.get("error_code") ?? params.get("error");
  if (providerError) {
    return {
      kind: "error",
      error: providerError === "otp_expired" ? "expired" : "invalid",
      next,
    };
  }

  const code = params.get("code");
  if (code) return { kind: "code", code, next };

  const tokenHash = params.get("token_hash");
  const type = params.get("type");
  if (!tokenHash || !type) return { kind: "error", error: "missing", next };
  if (!ALLOWED_OTP_TYPES.includes(type))
    return { kind: "error", error: "invalid", next };

  return { kind: "otp", tokenHash, type, next };
}

export function classifyAuthError(error: {
  code?: string;
  status?: number;
  message?: string;
}): ConfirmationError {
  if (error.code === "otp_expired" || /expired/i.test(error.message ?? ""))
    return "expired";
  if (error.status && error.status >= 400 && error.status < 500)
    return "invalid";
  return "unknown";
}

export type ConfirmationAuthClient = {
  auth: {
    verifyOtp: (params: { token_hash: string; type: EmailOtpType }) => Promise<{
      error: { code?: string; status?: number; message?: string } | null;
    }>;
    exchangeCodeForSession: (code: string) => Promise<{
      error: { code?: string; status?: number; message?: string } | null;
    }>;
  };
};

export function confirmationErrorPath(error: ConfirmationError): string {
  return `${CONFIRMATION_PAGE}?error=${error}`;
}

/**
 * Verifies the link from the confirmation e-mail and returns the path to
 * redirect to: the requested page on success, the confirmation page otherwise.
 */
export async function completeConfirmation(
  request: ConfirmationRequest,
  client: ConfirmationAuthClient | null,
): Promise<string> {
  if (request.kind === "error") return confirmationErrorPath(request.error);
  if (!client) return confirmationErrorPath("unknown");

  try {
    const { error } =
      request.kind === "otp"
        ? await client.auth.verifyOtp({
            token_hash: request.tokenHash,
            type: request.type,
          })
        : await client.auth.exchangeCodeForSession(request.code);
    return error
      ? confirmationErrorPath(classifyAuthError(error))
      : request.next;
  } catch {
    return confirmationErrorPath("unknown");
  }
}

/** URL to pass as `emailRedirectTo` when signing up or resending the e-mail. */
export function emailRedirectUrl(
  origin: string,
  next = DEFAULT_AFTER_CONFIRM,
): string {
  const url = new URL(CONFIRM_ROUTE, origin);
  url.searchParams.set("next", safeNextPath(next));
  return url.toString();
}

export type ResendAuthClient = {
  auth: {
    resend: (params: {
      type: "signup";
      email: string;
      options?: { emailRedirectTo?: string };
    }) => Promise<{
      error: { status?: number; code?: string; message?: string } | null;
    }>;
  };
};

export type ResendResult =
  | { ok: true; message: string }
  | { ok: false; field?: "email"; message: string };

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function resendConfirmation(
  client: ResendAuthClient | null,
  rawEmail: string,
  origin: string,
): Promise<ResendResult> {
  const email = normalizeEmail(rawEmail);
  if (!isValidEmail(email)) {
    return { ok: false, field: "email", message: "Vnesi veljaven e-naslov." };
  }
  if (!client) {
    return {
      ok: false,
      message: "Prijava trenutno ni na voljo. Poskusi znova kasneje.",
    };
  }

  try {
    const { error } = await client.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: emailRedirectUrl(origin) },
    });
    if (error) {
      if (error.status === 429 || error.code === "over_email_send_rate_limit") {
        return {
          ok: false,
          message:
            "Poslali smo že več e-sporočil. Počakaj nekaj minut in poskusi znova.",
        };
      }
      return {
        ok: false,
        message: "E-sporočila ni bilo mogoče poslati. Poskusi znova kasneje.",
      };
    }
  } catch {
    return {
      ok: false,
      message:
        "E-sporočila ni bilo mogoče poslati. Preveri povezavo in poskusi znova.",
    };
  }

  // Same message whether or not the account exists, to avoid account enumeration.
  return {
    ok: true,
    message: `Če račun za ${email} čaka na potrditev, smo poslali novo povezavo.`,
  };
}
