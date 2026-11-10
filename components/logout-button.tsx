"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "./auth-provider";
import { useI18n } from "../lib/i18n/provider";

export function LogoutButton() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { m } = useI18n();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function logout() {
    if (pending) return;
    setPending(true);
    setFailed(false);
    const result = await signOut();
    if (result.ok) {
      router.replace(result.redirectTo);
      router.refresh();
      return;
    }
    setFailed(true);
    setPending(false);
  }

  return (
    <>
      {failed && (
        <p className="error-message" role="alert">
          {m.auth.logout.failed}
        </p>
      )}
      <button
        className="button button-outline full-button"
        type="button"
        onClick={logout}
        disabled={pending}
        aria-busy={pending || undefined}
      >
        {pending ? m.auth.logout.pending : m.auth.logout.submit}
      </button>
    </>
  );
}
