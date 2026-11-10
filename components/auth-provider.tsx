"use client";

import type { AuthError, Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";
import { performLogout, type LogoutResult } from "../lib/auth/logout";
import { useFavorites } from "./providers";
import { useI18n } from "../lib/i18n/provider";
import {
  createLoginRedirect,
  getRouteAccess,
  getSafeReturnPath,
  requiresSession,
} from "../lib/auth/routes";

/**
 * Why sign-in is unavailable; the UI shows `m.auth.session.errors[code]`
 * (the raw Supabase message is never shown).
 */
export type AuthErrorCode = "session" | "configuration";

type AuthContextValue = {
  /** False when the public Supabase variables are missing. */
  configured: boolean;
  session: Session | null;
  pending: boolean;
  error: AuthErrorCode | null;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ error: AuthError | null }>;
  /** Local-scope sign-out (Android parity) that also clears cached user data. */
  signOut: () => Promise<LogoutResult>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthClient = ReturnType<typeof createSupabaseBrowserClient>;
type SessionCallbacks = {
  setSession: (session: Session | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: AuthErrorCode | null) => void;
  onSignedOut?: () => void;
};

export function initializeAuthSession(
  client: AuthClient,
  callbacks: SessionCallbacks,
) {
  let active = true;
  // Auth events always win over the initial restore, so a slow getSession can never
  // overwrite a newer sign-in or sign-out (ported from the session-restoration feature).
  let receivedEvent = false;
  const sessionRequest = client.auth
    .getSession()
    .then(({ data, error: sessionError }) => {
      if (!active || receivedEvent) return;
      callbacks.setSession(data.session);
      if (sessionError) callbacks.setError("session");
      callbacks.setLoading(false);
    })
    .catch(() => {
      if (!active || receivedEvent) return;
      callbacks.setError("session");
      callbacks.setLoading(false);
    });

  const {
    data: { subscription },
  } = client.auth.onAuthStateChange((event, nextSession) => {
    if (!active) return;
    // An empty INITIAL_SESSION mirrors getSession; let the restore report its errors.
    if (event === "INITIAL_SESSION" && !nextSession) return;
    receivedEvent = true;
    callbacks.setSession(nextSession);
    callbacks.setLoading(false);
    callbacks.setError(null);
    if (event === "SIGNED_OUT") callbacks.onSignedOut?.();
  });

  return {
    sessionRequest,
    unsubscribe: () => {
      active = false;
      subscription.unsubscribe();
    },
  };
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState<AuthErrorCode | null>(null);
  const { m } = useI18n();
  const queryClient = useQueryClient();
  const { resetFavorites } = useFavorites();
  const client = useMemo(() => {
    try {
      return createSupabaseBrowserClient();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!client) {
      setError("configuration");
      setPending(false);
      return;
    }
    return initializeAuthSession(client, {
      setSession,
      setLoading: setPending,
      setError,
      onSignedOut: () => router.replace("/login"),
    }).unsubscribe;
  }, [client, router]);

  useEffect(() => {
    if (pending || error) return;
    const access = getRouteAccess(pathname);
    if (requiresSession(access) && !session) {
      router.replace(createLoginRedirect(pathname, window.location.search));
    } else if (access === "public" && session) {
      // Honour the requested destination after signing in on /login.
      const returnTo = new URLSearchParams(window.location.search).get(
        "returnTo",
      );
      router.replace(getSafeReturnPath(returnTo));
    }
  }, [error, pathname, pending, router, session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      configured: client !== null,
      session,
      pending,
      error,
      signIn: async (email, password) => {
        if (!client) throw new Error("Supabase is not configured");
        return client.auth.signInWithPassword({ email, password });
      },
      signOut: () =>
        performLogout({
          client,
          clearServerState: () => queryClient.clear(),
          resetUserState: resetFavorites,
          storage: window.localStorage,
        }),
    }),
    [client, error, pending, queryClient, resetFavorites, session],
  );

  const access = getRouteAccess(pathname);
  // Public pages (login, register) show the error next to their own form.
  if (error && requiresSession(access)) {
    return (
      <div className="page-state" role="alert">
        <h1>{m.auth.session.unavailableTitle}</h1>
        <p>{m.auth.session.errors[error]}</p>
      </div>
    );
  }
  if (requiresSession(access) && (pending || !session)) {
    return (
      <div className="page-state" aria-live="polite">
        <p>{m.auth.session.checking}</p>
      </div>
    );
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
