"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";
import { getRouteAccess } from "../lib/auth/routes";

type AuthContextValue = {
  session: Session | null;
  pending: boolean;
  error: string | null;
  signOut: () => Promise<void>;
};
const AuthContext = createContext<AuthContextValue | null>(null);

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

  useEffect(() => {
    let active = true;
    let client: ReturnType<typeof createSupabaseBrowserClient>;
    try {
      client = createSupabaseBrowserClient();
    } catch (cause) {
      if (active) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Supabase configuration failed.",
        );
        setPending(false);
      }
      return;
    }
    client.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setError(sessionError.message);
      setSession(data.session);
      setPending(false);
    });
    const { data } = client.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setPending(false);
      if (event === "SIGNED_OUT") router.replace("/login");
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    if (pending || error) return;
    const access = getRouteAccess(pathname);
    if (access !== "public" && !session) {
      router.replace(
        `/login?returnTo=${encodeURIComponent(`${pathname}${window.location.search}`)}`,
      );
    } else if (access === "public" && session) {
      router.replace("/listings");
    }
  }, [error, pathname, pending, router, session]);

  async function signOut() {
    const client = createSupabaseBrowserClient();
    const { error: signOutError } = await client.auth.signOut();
    if (signOutError) setError(signOutError.message);
    else router.replace("/login");
  }

  const access = getRouteAccess(pathname);
  if (error) {
    return (
      <div className="page-state" role="alert">
        <h1>Prijava ni na voljo</h1>
        <p>{error}</p>
      </div>
    );
  }
  if (pending || (access !== "public" && !session)) {
    return (
      <div className="page-state" aria-live="polite">
        <p>Preverjanje prijave ...</p>
      </div>
    );
  }
  return (
    <AuthContext.Provider value={{ session, pending, error, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
