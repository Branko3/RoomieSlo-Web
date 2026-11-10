import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

export type SessionStatus =
  "loading" | "authenticated" | "unauthenticated" | "unconfigured";

export type SessionUser = {
  id: string;
  email: string | null;
  /**
   * Metadata name, else the e-mail's local part; empty when neither exists
   * (the UI then shows `m.auth.session.fallbackName`).
   */
  displayName: string;
};

/** Error code of a failed restore; the UI shows `m.auth.session.restoreFailed`. */
export const SESSION_RESTORE_ERROR = "restore_failed";
export type SessionError = typeof SESSION_RESTORE_ERROR;

export type SessionState = {
  status: SessionStatus;
  user: SessionUser | null;
  error: SessionError | null;
};

type Subscription = { unsubscribe: () => void };

/** The subset of the Supabase auth client used for session restoration. */
export type SessionAuthClient = {
  auth: {
    getSession: () => Promise<{
      data: { session: Session | null };
      error: { message: string } | null;
    }>;
    onAuthStateChange: (
      callback: (event: AuthChangeEvent, session: Session | null) => void,
    ) => { data: { subscription: Subscription } };
  };
};

export const initialSessionState: SessionState = {
  status: "loading",
  user: null,
  error: null,
};

export function toSessionUser(session: Session): SessionUser {
  const { user } = session;
  const metadataName =
    user.user_metadata?.display_name ?? user.user_metadata?.name;
  const displayName =
    typeof metadataName === "string" && metadataName.trim()
      ? metadataName.trim()
      : (user.email?.split("@")[0] ?? "");

  return { id: user.id, email: user.email ?? null, displayName };
}

export function sessionStateFrom(session: Session | null): SessionState {
  return session
    ? { status: "authenticated", user: toSessionUser(session), error: null }
    : { status: "unauthenticated", user: null, error: null };
}

/**
 * Restores the persisted Supabase session and keeps listening for auth changes
 * (sign-in, token refresh, sign-out). Auth events always win over the initial
 * `getSession` result, so a late restore can never overwrite a newer state.
 * Returns a cleanup function that stops all further updates.
 */
export function startSessionRestoration(
  client: SessionAuthClient | null,
  onState: (state: SessionState) => void,
): () => void {
  if (!client) {
    onState({ status: "unconfigured", user: null, error: null });
    return () => {};
  }

  let active = true;
  let receivedEvent = false;

  const {
    data: { subscription },
  } = client.auth.onAuthStateChange((event, session) => {
    if (!active) return;
    // INITIAL_SESSION mirrors getSession; let the explicit restore report errors.
    if (event === "INITIAL_SESSION" && !session) return;
    receivedEvent = true;
    onState(
      event === "SIGNED_OUT"
        ? sessionStateFrom(null)
        : sessionStateFrom(session),
    );
  });

  client.auth
    .getSession()
    .then(({ data, error }) => {
      if (!active || receivedEvent) return;
      onState(
        error
          ? {
              status: "unauthenticated",
              user: null,
              error: SESSION_RESTORE_ERROR,
            }
          : sessionStateFrom(data.session),
      );
    })
    .catch(() => {
      if (!active || receivedEvent) return;
      onState({
        status: "unauthenticated",
        user: null,
        error: SESSION_RESTORE_ERROR,
      });
    });

  return () => {
    active = false;
    subscription.unsubscribe();
  };
}

export type ProfileSummary =
  | { kind: "loading" }
  | { kind: "signed-in"; name: string; initials: string }
  | { kind: "signed-out"; error: SessionError | null }
  | { kind: "preview" };

export function initialsFor(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "");
  return letters.join("") || "?";
}

/**
 * Maps the session state to what the navigation profile area should show.
 * `fallbackName` (`m.auth.session.fallbackName`) names a user without a
 * display name or e-mail.
 */
export function profileSummary(
  state: SessionState,
  fallbackName = "",
): ProfileSummary {
  switch (state.status) {
    case "loading":
      return { kind: "loading" };
    case "authenticated":
      if (!state.user) return { kind: "signed-out", error: null };
      return {
        kind: "signed-in",
        name: state.user.displayName || fallbackName,
        initials: initialsFor(state.user.displayName || fallbackName),
      };
    case "unauthenticated":
      return { kind: "signed-out", error: state.error };
    case "unconfigured":
      return { kind: "preview" };
  }
}
