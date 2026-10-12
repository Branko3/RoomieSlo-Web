"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "./auth-provider";

export function LogoutButton() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function logout() {
    if (pending) return;
    setPending(true);
    setError(null);
    const result = await signOut();
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
