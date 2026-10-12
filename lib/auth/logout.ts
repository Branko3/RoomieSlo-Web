export const LOGIN_ROUTE = "/login";
export const LOCAL_DATA_PREFIX = "roomieslo:";
export const LOGOUT_ERROR =
  "Odjava ni uspela. Preveri povezavo in poskusi znova.";

/** The subset of the Supabase auth client used for logout. */
export type LogoutAuthClient = {
  auth: {
    signOut: (options: {
      scope: "local";
    }) => Promise<{ error: { message: string } | null }>;
  };
};

export type LogoutDependencies = {
  client: LogoutAuthClient | null;
  /** Removes cached server state, e.g. the TanStack Query cache. */
  clearServerState: () => void;
  /** Resets in-memory user data such as favorites. */
  resetUserState: () => void;
  storage: Pick<Storage, "length" | "key" | "removeItem"> | null;
};

export type LogoutResult =
  { ok: true; redirectTo: string } | { ok: false; message: string };

/** Removes every app-owned `roomieslo:` key so the next user of the browser starts clean. */
export function clearLocalUserData(
  storage: LogoutDependencies["storage"],
): void {
  if (!storage) return;
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(LOCAL_DATA_PREFIX)) keys.push(key);
  }
  keys.forEach((key) => storage.removeItem(key));
}

/**
 * Signs the user out on this device (Android parity: local scope, other
 * devices stay signed in) and clears user data held in the browser.
 *
 * Supabase removes the stored session even when revoking it on the server
 * fails, so an `error` result still counts as signed out. Only an unexpected
 * exception leaves the user signed in and reports a retryable error.
 */
export async function performLogout({
  client,
  clearServerState,
  resetUserState,
  storage,
}: LogoutDependencies): Promise<LogoutResult> {
  if (client) {
    try {
      await client.auth.signOut({ scope: "local" });
    } catch {
      return { ok: false, message: LOGOUT_ERROR };
    }
  }

  clearServerState();
  resetUserState();
  clearLocalUserData(storage);
  return { ok: true, redirectTo: LOGIN_ROUTE };
}
