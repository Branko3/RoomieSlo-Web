"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { performLogout } from "../lib/auth/logout";
import { getSupabaseConfig } from "../lib/config";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";
import { useFavorites } from "./providers";

export function LogoutButton() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { resetFavorites } = useFavorites();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function logout() {
    if (pending) return;
    setPending(true);
    setError(null);
    const result = await performLogout({
      client: getSupabaseConfig().configured
        ? createSupabaseBrowserClient()
        : null,
      clearServerState: () => queryClient.clear(),
      resetUserState: resetFavorites,
      storage: window.localStorage,
    });
    if (result.ok) {
      router.replace(result.redirectTo);
      router.refresh();
      return;
    }
    setError(result.message);
    setPending(false);
  }

  return (
    <>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      <button
        className="button button-outline full-button"
        type="button"
        onClick={logout}
        disabled={pending}
        aria-busy={pending || undefined}
      >
        {pending ? "Odjavljanje …" : "Odjava"}
      </button>
    </>
  );
}
