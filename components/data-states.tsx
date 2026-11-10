"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import {
  AlertIcon,
  LockIcon,
  OfflineIcon,
  SearchIcon,
  UserIcon,
} from "./icons";
import { useI18n } from "../lib/i18n/provider";

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

export function LoadingState({ label }: { label?: string }) {
  const { m } = useI18n();
  return (
    <div className="page-state state-loading" role="status" aria-live="polite">
      <span className="state-spinner" aria-hidden="true" />
      <p>{label ?? m.common.loading.content}</p>
    </div>
  );
}

/**
 * Loading placeholder shaped like the listing flyers it stands in for, so the
 * page does not jump when they arrive. The label is announced once.
 */
export function ListingGridSkeleton({
  label,
  count = 3,
}: {
  label?: string;
  count?: number;
}) {
  const { m } = useI18n();
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">{label ?? m.common.loading.listings}</span>
      <div className="listing-grid" aria-hidden="true">
        {Array.from({ length: count }, (_, index) => (
          <div className="listing-card skeleton-card" key={index}>
            <div className="listing-art skeleton-block" />
            <div className="listing-body">
              <span className="skeleton-line skeleton-short" />
              <span className="skeleton-line" />
              <span className="skeleton-line skeleton-short" />
            </div>
            <div className="tear-strip">
              <span className="skeleton-line skeleton-short" />
            </div>
          </div>
        ))}
      </div>
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
        <SearchIcon size={28} />
      </span>
      <h2 id="empty-state-title">{title}</h2>
      <p>{description}</p>
      {action}
    </section>
  );
}

export function OfflineState({ onRetry }: { onRetry?: () => void }) {
  const { m } = useI18n();
  return (
    <section
      className="page-state state-offline"
      role="alert"
      aria-labelledby="offline-state-title"
    >
      <span className="state-icon" aria-hidden="true">
        <OfflineIcon size={28} />
      </span>
      <h2 id="offline-state-title">{m.errors.offline.title}</h2>
      <p>{m.errors.offline.body}</p>
      {onRetry && (
        <button className="button" type="button" onClick={onRetry}>
          {m.common.actions.retry}
        </button>
      )}
    </section>
  );
}

export function PermissionDeniedState({ onRetry }: { onRetry?: () => void }) {
  const { m } = useI18n();
  return (
    <section
      className="page-state state-denied"
      role="alert"
      aria-labelledby="denied-state-title"
    >
      <span className="state-icon" aria-hidden="true">
        <LockIcon size={28} />
      </span>
      <h2 id="denied-state-title">{m.errors.permission.title}</h2>
      <p>{m.errors.permission.body}</p>
      {onRetry && (
        <button
          className="button button-outline"
          type="button"
          onClick={onRetry}
        >
          {m.common.actions.retry}
        </button>
      )}
      <Link className="button" href="/listings">
        {m.errors.permission.action}
      </Link>
    </section>
  );
}

export function AuthenticationRequiredState() {
  const { m } = useI18n();
  return (
    <section
      className="page-state state-auth"
      role="alert"
      aria-labelledby="auth-state-title"
    >
      <span className="state-icon" aria-hidden="true">
        <UserIcon size={28} />
      </span>
      <h2 id="auth-state-title">{m.errors.authRequired.title}</h2>
      <p>{m.errors.authRequired.body}</p>
      <Link className="button" href="/login">
        {m.errors.authRequired.action}
      </Link>
    </section>
  );
}

export function ErrorState({
  onRetry,
  action,
  title,
}: {
  onRetry?: () => void;
  action?: React.ReactNode;
  title?: string;
}) {
  const { m } = useI18n();
  return (
    <section
      className="page-state state-error"
      role="alert"
      aria-labelledby="error-state-title"
    >
      <span className="state-icon" aria-hidden="true">
        <AlertIcon size={28} />
      </span>
      <h2 id="error-state-title">{title ?? m.errors.load.title}</h2>
      <p>{m.errors.load.body}</p>
      <div className="state-actions">
        {onRetry && (
          <button className="button" type="button" onClick={onRetry}>
            {m.common.actions.retry}
          </button>
        )}
        {action ?? (
          <Link className="button button-outline" href="/listings">
            {m.common.actions.toListings}
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
