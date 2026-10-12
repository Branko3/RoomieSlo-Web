import type { RealtimeStatus } from "./realtime";

/** Android `ChatRealtimeService`: 1 s, doubled per attempt, capped at 30 s. */
export const BASE_DELAY_MS = 1_000;
export const MAX_DELAY_MS = 30_000;
export const MAX_SHIFT = 5;

/** Delay before reconnect attempt `attempt` (0-based): 1, 2, 4, 8, 16, 30, 30, … seconds. */
export function backoffDelay(attempt: number): number {
  const shift = Math.min(Math.max(0, Math.floor(attempt)), MAX_SHIFT);
  return Math.min(BASE_DELAY_MS * 2 ** shift, MAX_DELAY_MS);
}

export type ReconnectState = RealtimeStatus | "waiting";

export type Timer = {
  set: (callback: () => void, ms: number) => unknown;
  clear: (handle: unknown) => void;
};

const browserTimer: Timer = {
  set: (callback, ms) => setTimeout(callback, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export type ReconnectOptions = {
  /** Opens one subscription; must report statuses and return its cleanup. */
  connect: (onStatus: (status: RealtimeStatus) => void) => () => void;
  /** Called after a reconnect succeeds, to reconcile missed messages. */
  onReconnected: () => void;
  onState: (state: ReconnectState, retryInMs?: number) => void;
  timer?: Timer;
};

/**
 * Keeps one Realtime subscription alive with bounded exponential backoff
 * (Android: 1, 2, 4, 8, 16, then 30 s; the counter resets once subscribed).
 * After a reconnect (not the first connection) the history is reconciled.
 * `pause` stops everything (e.g. hidden tab); `resume` and `retryNow`
 * reconnect immediately (tab visible again, browser back online).
 */
export function createReconnectingSubscription({
  connect,
  onReconnected,
  onState,
  timer = browserTimer,
}: ReconnectOptions) {
  let attempt = 0;
  let everConnected = false;
  let stopCurrent: (() => void) | null = null;
  // Identifies the current connection; set before `connect` runs because
  // statuses may be reported synchronously while connecting.
  let currentToken: object | null = null;
  let pending: unknown = null;
  let running = false;

  const clearPending = () => {
    if (pending !== null) timer.clear(pending);
    pending = null;
  };

  const closeCurrent = () => {
    const stop = stopCurrent;
    stopCurrent = null;
    currentToken = null;
    stop?.();
  };

  const open = () => {
    if (!running) return;
    clearPending();
    closeCurrent();
    let settled = false;
    const token = {};
    currentToken = token;
    const stop = connect((status) => {
      if (!running || currentToken !== token) return;
      if (status === "live") {
        settled = false;
        const reconnected = everConnected;
        everConnected = true;
        attempt = 0;
        onState("live");
        if (reconnected) onReconnected();
        return;
      }
      if (status === "disconnected") {
        if (settled) return;
        settled = true;
        scheduleRetry();
        return;
      }
      onState("connecting");
    });
    // A synchronous failure may already have scheduled a retry and closed this one.
    if (currentToken === token) stopCurrent = stop;
    else stop();
  };

  const scheduleRetry = () => {
    if (!running) return;
    closeCurrent();
    clearPending();
    const delay = backoffDelay(attempt);
    attempt += 1;
    onState("waiting", delay);
    pending = timer.set(() => {
      pending = null;
      open();
    }, delay);
  };

  return {
    start() {
      if (running) return;
      running = true;
      open();
    },
    /** Stop all activity (hidden tab, unmount). */
    pause() {
      running = false;
      clearPending();
      closeCurrent();
      onState("disconnected");
    },
    /** Reconnect at once, e.g. tab visible again; counts as a reconnect if connected before. */
    resume() {
      if (running) return;
      running = true;
      attempt = 0;
      open();
    },
    /** Skip the remaining wait (browser came back online). */
    retryNow() {
      if (!running || stopCurrent) return;
      attempt = 0;
      open();
    },
    /** Current attempt counter, for tests and diagnostics. */
    attempts: () => attempt,
  };
}
