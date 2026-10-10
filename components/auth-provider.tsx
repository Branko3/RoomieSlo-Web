"use client";

import type { AuthError, Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
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
};

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
      if (sessionError)
        callbacks.setError("Seje ni mogoče preveriti. Poskusite znova.");
      callbacks.setLoading(false);
    })
    .catch(() => {
      if (!active) return;
      callbacks.setError("Seje ni mogoče preveriti. Poskusite znova.");
      callbacks.setLoading(false);
    });

  const {
    data: { subscription },
  } = client.auth.onAuthStateChange((_event, nextSession) => {
    if (!active) return;
    callbacks.setSession(nextSession);
    callbacks.setLoading(false);
    callbacks.setError(null);
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
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside Providers");
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
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
      setError("Prijava trenutno ni na voljo. Poskusite znova pozneje.");
      setLoading(false);
      return;
    }

    const initialized = initializeAuthSession(client, {
      setSession,
      setLoading,
      setError,
    });
    return initialized.unsubscribe;
  }, [client]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      loading,
      error,
      signIn: async (email, password) => {
        if (!client) throw new Error("Supabase is not configured");
        const result = await client.auth.signInWithPassword({
          email,
          password,
        });
        return result;
      },
      signOut: async () => {
        if (!client) throw new Error("Supabase is not configured");
        return client.auth.signOut();
      },
    }),
    [client, error, loading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
