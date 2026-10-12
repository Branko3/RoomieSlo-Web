"use client";

import { useAuth } from "./auth-provider";
import {
  SESSION_RESTORE_ERROR,
  sessionStateFrom,
  type SessionState,
} from "../lib/auth/session";

/**
 * Session restoration state for UI (navigation profile area). It is derived from the single
 * AuthProvider, which restores the persisted Supabase session after a refresh and follows
 * auth changes, so no second Supabase subscription is created.
 */
export function useSession(): SessionState {
  const { configured, pending, session, error } = useAuth();
  if (!configured) return { status: "unconfigured", user: null, error: null };
  if (pending) return { status: "loading", user: null, error: null };
  if (session) return sessionStateFrom(session);
  return {
    status: "unauthenticated",
    user: null,
    error: error ? SESSION_RESTORE_ERROR : null,
  };
}
