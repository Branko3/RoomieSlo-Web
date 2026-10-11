"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getSupabaseConfig } from "../lib/config";
import {
  initialSessionState,
  startSessionRestoration,
  type SessionState,
} from "../lib/auth/session";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";

const SessionContext = createContext<SessionState | null>(null);

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used inside SessionProvider");
  }
  return context;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionState>(initialSessionState);

  useEffect(() => {
    const client = getSupabaseConfig().configured
      ? createSupabaseBrowserClient()
      : null;
    return startSessionRestoration(client, setState);
  }, []);

  return (
    <SessionContext.Provider value={state}>{children}</SessionContext.Provider>
  );
}
