"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";

export type DataErrorKind = "offline" | "permission" | "auth" | "error";

export function classifyDataError(
  error: unknown,
  online = true,
): DataErrorKind {
  if (!online) return "offline";
  const value = error as {
    status?: number;
    code?: string;
    message?: string;
  } | null;
  const message = value?.message?.toLowerCase() ?? "";
  if (
    value?.status === 401 ||
    value?.code === "PGRST301" ||
    message.includes("jwt")
  )
    return "auth";
  if (
    value?.status === 403 ||
    value?.code === "42501" ||
    message.includes("permission") ||
    message.includes("rls")
  ) {
    return "permission";
  }
  return "error";
}

export function useOnlineStatus() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(window.navigator.onLine);
    update();
    return subscribeToOnlineStatus(update);
  }, []);
  return online;
}

export function subscribeToOnlineStatus(update: () => void) {
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  return () => {
    window.removeEventListener("online", update);
    window.removeEventListener("offline", update);
  };
}

export function LoadingState({
  label = "Nalaganje vsebine ...",
}: {
  label?: string;
}) {
  return (
    <div className="page-state state-loading" role="status" aria-live="polite">
      <span className="state-spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <section
      className="page-state state-empty"
      aria-labelledby="empty-state-title"
    >
      <span className="state-icon" aria-hidden="true">
        ⌕
      </span>
      <h2 id="empty-state-title">{title}</h2>
      <p>{description}</p>
      {action}
    </section>
  );
}

export function OfflineState({ onRetry }: { onRetry?: () => void }) {
  return (
    <section
      className="page-state state-offline"
      role="alert"
      aria-labelledby="offline-state-title"
    >
      <span className="state-icon" aria-hidden="true">
        ⌁
      </span>
      <h2 id="offline-state-title">Trenutno si brez povezave</h2>
      <p>
        Preveri internetno povezavo. Ko bo povezava spet na voljo, poskusi
        znova.
      </p>
      {onRetry && (
        <button className="button" type="button" onClick={onRetry}>
          Poskusi znova
        </button>
      )}
    </section>
  );
}

export function PermissionDeniedState({ onRetry }: { onRetry?: () => void }) {
  return (
    <section
      className="page-state state-denied"
      role="alert"
      aria-labelledby="denied-state-title"
    >
      <span className="state-icon" aria-hidden="true">
        !
      </span>
      <h2 id="denied-state-title">Dostop do vsebine ni dovoljen</h2>
      <p>Tvoj račun nima dovoljenja za ogled te vsebine.</p>
      {onRetry && (
        <button
          className="button button-outline"
          type="button"
          onClick={onRetry}
        >
          Poskusi znova
        </button>
      )}
      <Link className="button" href="/listings">
        Na dovoljeno vsebino
      </Link>
    </section>
  );
}

export function AuthenticationRequiredState() {
  return (
    <section
      className="page-state state-auth"
      role="alert"
      aria-labelledby="auth-state-title"
    >
      <h2 id="auth-state-title">Prijava je potrebna</h2>
      <p>Za ogled te vsebine se prijavi v svoj račun.</p>
      <Link className="button" href="/login">
        Na prijavo
      </Link>
    </section>
  );
}

export function ErrorState({
  onRetry,
  action,
  title = "Vsebine ni mogoče naložiti",
}: {
  onRetry?: () => void;
  action?: React.ReactNode;
  title?: string;
}) {
  return (
    <section
      className="page-state state-error"
      role="alert"
      aria-labelledby="error-state-title"
    >
      <h2 id="error-state-title">{title}</h2>
      <p>Prišlo je do napake. Poskusi znova ali se vrni na oglase.</p>
      <div className="state-actions">
        {onRetry && (
          <button className="button" type="button" onClick={onRetry}>
            Poskusi znova
          </button>
        )}
        {action ?? (
          <Link className="button button-outline" href="/listings">
            Na oglase
          </Link>
        )}
      </div>
    </section>
  );
}

export function DataState({
  error,
  onRetry,
  children,
}: {
  error: unknown;
  onRetry?: () => void;
  children: React.ReactNode;
}) {
  const online = useOnlineStatus();
  if (error) {
    const kind = classifyDataError(error, online);
    if (kind === "offline") return <OfflineState onRetry={onRetry} />;
    if (kind === "permission")
      return <PermissionDeniedState onRetry={onRetry} />;
    if (kind === "auth") return <AuthenticationRequiredState />;
    return <ErrorState onRetry={onRetry} />;
  }
  return <>{children}</>;
}
