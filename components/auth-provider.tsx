"use client";

import type { AuthError, Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";
import {
  createLoginRedirect,
  getRouteAccess,
  getSafeReturnPath,
} from "../lib/auth/routes";

type AuthContextValue = {
  session: Session | null;
  pending: boolean;
  error: string | null;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthClient = ReturnType<typeof createSupabaseBrowserClient>;
type SessionCallbacks = {
  setSession: (session: Session | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  onSignedOut?: () => void;
};

const SESSION_ERROR = "Seje ni mogoče preveriti. Poskusite znova.";

export function initializeAuthSession(
  client: AuthClient,
  callbacks: SessionCallbacks,
) {
  let active = true;
  const sessionRequest = client.auth
    .getSession()
    .then(({ data, error: sessionError }) => {
      if (!active) return;
      callbacks.setSession(data.session);
      if (sessionError) callbacks.setError(SESSION_ERROR);
      callbacks.setLoading(false);
    })
    .catch(() => {
      if (!active) return;
      callbacks.setError(SESSION_ERROR);
      callbacks.setLoading(false);
    });

  const {
    data: { subscription },
  } = client.auth.onAuthStateChange((event, nextSession) => {
    if (!active) return;
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
  const [error, setError] = useState<string | null>(null);
  const client = useMemo(() => {
    try {
      return createSupabaseBrowserClient();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!client) {
      setError("Supabase configuration failed. Prijava trenutno ni na voljo.");
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
    if (access !== "public" && !session) {
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
      session,
      pending,
      error,
      signIn: async (email, password) => {
        if (!client) throw new Error("Supabase is not configured");
        return client.auth.signInWithPassword({ email, password });
      },
      signOut: async () => {
        if (!client) throw new Error("Supabase is not configured");
        const result = await client.auth.signOut();
        if (result.error) setError("Odjava ni uspela. Poskusite znova.");
        return result;
      },
    }),
    [client, error, pending, session],
  );

  const access = getRouteAccess(pathname);
  // Public pages (login, register) show the error next to their own form.
  if (error && access !== "public") {
    return (
      <div className="page-state" role="alert">
        <h1>Prijava ni na voljo</h1>
        <p>{error}</p>
      </div>
    );
  }
  if (access !== "public" && (pending || !session)) {
    return (
      <div className="page-state" aria-live="polite">
        <p>Preverjanje prijave ...</p>
      </div>
    );
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
