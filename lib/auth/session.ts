import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

export type SessionStatus =
  "loading" | "authenticated" | "unauthenticated" | "unconfigured";

export type SessionUser = {
  id: string;
  email: string | null;
  displayName: string;
};

export type SessionState = {
  status: SessionStatus;
  user: SessionUser | null;
  error: string | null;
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

export const SESSION_RESTORE_ERROR =
  "Seje ni bilo mogoče obnoviti. Prijavi se znova.";

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
      : (user.email?.split("@")[0] ?? "Uporabnik");

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
  | { kind: "signed-out"; error: string | null }
  | { kind: "preview" };

export function initialsFor(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "");
  return letters.join("") || "?";
}

/** Maps the session state to what the navigation profile area should show. */
export function profileSummary(state: SessionState): ProfileSummary {
  switch (state.status) {
    case "loading":
      return { kind: "loading" };
    case "authenticated":
      return state.user
        ? {
            kind: "signed-in",
            name: state.user.displayName,
            initials: initialsFor(state.user.displayName),
          }
        : { kind: "signed-out", error: null };
    case "unauthenticated":
      return { kind: "signed-out", error: state.error };
    case "unconfigured":
      return { kind: "preview" };
  }
}
