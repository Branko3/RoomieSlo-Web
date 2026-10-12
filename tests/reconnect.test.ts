import { describe, expect, it, vi } from "vitest";
import { liveNotice } from "../components/use-message-realtime";
import type { RealtimeStatus } from "../lib/chat/realtime";
import {
  backoffDelay,
  createReconnectingSubscription,
  MAX_DELAY_MS,
  type Timer,
} from "../lib/chat/reconnect";

/** Manual timer: tests decide when scheduled callbacks run. */
function manualTimer() {
  const queue = new Map<number, { callback: () => void; ms: number }>();
  let next = 1;
  const timer: Timer = {
    set: (callback, ms) => {
      const id = next++;
      queue.set(id, { callback, ms });
      return id;
    },
    clear: (handle) => {
      queue.delete(handle as number);
    },
  };
  return {
    timer,
    delays: () => [...queue.values()].map((entry) => entry.ms),
    runNext: () => {
      const [id, entry] = [...queue.entries()][0] ?? [];
      if (id === undefined || !entry) throw new Error("No timer scheduled");
      queue.delete(id);
      entry.callback();
    },
    size: () => queue.size,
  };
}

/** Fake connection factory: each connect() opens a new connection the test can drive. */
function fakeConnections() {
  const connections: Array<{
    report: (s: RealtimeStatus) => void;
    stop: ReturnType<typeof vi.fn>;
  }> = [];
  const connect = vi.fn((onStatus: (s: RealtimeStatus) => void) => {
    const stop = vi.fn();
    connections.push({ report: onStatus, stop });
    onStatus("connecting"); // like subscribeToMessages, reported synchronously
    return stop;
  });
  return {
    connect,
    connections,
    last: () => connections[connections.length - 1],
  };
}

function setup() {
  const clock = manualTimer();
  const conns = fakeConnections();
  const states: Array<[string, number | undefined]> = [];
  const onReconnected = vi.fn();
  const subscription = createReconnectingSubscription({
    connect: conns.connect,
    onReconnected,
    onState: (state, retryInMs) => states.push([state, retryInMs]),
    timer: clock.timer,
  });
  return { clock, conns, states, onReconnected, subscription };
}

describe("backoffDelay (Android ChatRealtimeService)", () => {
  it("follows 1, 2, 4, 8, 16, then 30 seconds", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 20].map(backoffDelay)).toEqual([
      1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000, 30_000,
    ]);
  });

  it("never exceeds the cap and handles odd input", () => {
    expect(backoffDelay(1_000)).toBe(MAX_DELAY_MS);
    expect(backoffDelay(-3)).toBe(1_000);
    expect(backoffDelay(2.7)).toBe(4_000);
  });
});

describe("createReconnectingSubscription", () => {
  it("connects once and reports live without reconciling the first time", () => {
    const { conns, states, onReconnected, subscription } = setup();
    subscription.start();
    conns.last().report("live");
    expect(conns.connect).toHaveBeenCalledTimes(1);
    expect(states.map(([s]) => s)).toEqual(["connecting", "live"]);
    expect(onReconnected).not.toHaveBeenCalled();
  });

  it("retries with growing delays and resets after a successful reconnect", () => {
    const { clock, conns, states, onReconnected, subscription } = setup();
    subscription.start();
    conns.last().report("live");

    for (let i = 0; i < 7; i += 1) {
      conns.last().report("disconnected");
      clock.runNext();
    }
    const waits = states.filter(([s]) => s === "waiting").map(([, ms]) => ms);
    expect(waits).toEqual([1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000]);

    conns.last().report("live");
    expect(onReconnected).toHaveBeenCalledTimes(1);
    expect(subscription.attempts()).toBe(0);

    conns.last().report("disconnected");
    expect(clock.delays()).toEqual([1_000]);
  });

  it("closes the broken connection before scheduling a retry", () => {
    const { conns, subscription } = setup();
    subscription.start();
    const first = conns.last();
    first.report("disconnected");
    expect(first.stop).toHaveBeenCalledTimes(1);
  });

  it("ignores repeated failure reports and reports from old connections", () => {
    const { clock, conns, subscription } = setup();
    subscription.start();
    const first = conns.last();
    first.report("disconnected");
    first.report("disconnected");
    expect(clock.size()).toBe(1);
    clock.runNext();
    first.report("live");
    expect(subscription.attempts()).toBe(1);
  });

  it("handles a connection that fails synchronously while connecting", () => {
    const clock = manualTimer();
    const stop = vi.fn();
    const subscription = createReconnectingSubscription({
      connect: (onStatus) => {
        onStatus("disconnected");
        return stop;
      },
      onReconnected: vi.fn(),
      onState: vi.fn(),
      timer: clock.timer,
    });
    subscription.start();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(clock.delays()).toEqual([1_000]);
  });

  it("pauses completely (hidden tab) and resumes at once with reconciliation", () => {
    const { clock, conns, states, onReconnected, subscription } = setup();
    subscription.start();
    conns.last().report("live");
    conns.last().report("disconnected");
    subscription.pause();
    expect(clock.size()).toBe(0);
    expect(states.at(-1)?.[0]).toBe("disconnected");

    subscription.resume();
    expect(conns.connect).toHaveBeenCalledTimes(2);
    conns.last().report("live");
    expect(onReconnected).toHaveBeenCalledTimes(1);
  });

  it("stops the live connection on pause and ignores its later events", () => {
    const { conns, onReconnected, subscription } = setup();
    subscription.start();
    const first = conns.last();
    first.report("live");
    subscription.pause();
    expect(first.stop).toHaveBeenCalledTimes(1);
    first.report("live");
    expect(onReconnected).not.toHaveBeenCalled();
  });

  it("skips the remaining wait when the browser comes back online", () => {
    const { clock, conns, subscription } = setup();
    subscription.start();
    conns.last().report("disconnected");
    conns.last();
    expect(clock.size()).toBe(1);
    subscription.retryNow();
    expect(clock.size()).toBe(0);
    expect(conns.connect).toHaveBeenCalledTimes(2);
  });

  it("does not open a second connection while one is active", () => {
    const { conns, subscription } = setup();
    subscription.start();
    subscription.start();
    subscription.retryNow();
    subscription.resume();
    expect(conns.connect).toHaveBeenCalledTimes(1);
  });
});

describe("liveNotice", () => {
  it("tells the user when the next retry happens", () => {
    expect(liveNotice({ state: "waiting", retryInMs: 4_000 })).toBe(
      "Povezava v živo je prekinjena. Ponovni poskus čez 4 s.",
    );
    expect(liveNotice({ state: "waiting", retryInMs: 200 })).toContain(
      "čez 1 s",
    );
  });

  it("explains a paused connection and stays quiet otherwise", () => {
    expect(liveNotice({ state: "disconnected" })).toContain("prekinjena");
    expect(liveNotice({ state: "live" })).toBeNull();
    expect(liveNotice({ state: "connecting" })).toBeNull();
  });
});
