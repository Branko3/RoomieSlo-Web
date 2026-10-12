import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  AuthenticationRequiredState,
  EmptyState,
  ErrorState,
  LoadingState,
  OfflineState,
  PermissionDeniedState,
  classifyDataError,
  subscribeToOnlineStatus,
} from "../components/data-states";

describe("data state classification", () => {
  it("keeps empty results separate from request errors", () => {
    expect(classifyDataError(null)).toBe("error");
  });

  it("classifies offline failures without exposing the original error", () => {
    expect(classifyDataError(new Error("network failed"), false)).toBe(
      "offline",
    );
  });

  it("distinguishes authorization from authentication failures", () => {
    expect(classifyDataError({ status: 403 })).toBe("permission");
    expect(classifyDataError({ status: 401 })).toBe("auth");
  });

  it("recognizes known Supabase authorization responses and safe fallbacks", () => {
    expect(classifyDataError({ code: "42501" })).toBe("permission");
    expect(classifyDataError({ code: "PGRST301" })).toBe("auth");
    expect(classifyDataError(new Error("JWT expired"))).toBe("auth");
    expect(classifyDataError(new Error("RLS policy rejected"))).toBe(
      "permission",
    );
    expect(classifyDataError(new Error("backend leaked detail"))).toBe("error");
  });

  it("prioritizes offline status over a backend error classification", () => {
    expect(classifyDataError({ status: 403 }, false)).toBe("offline");
  });

  it("registers and removes both connectivity listeners", () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    vi.stubGlobal("window", { addEventListener, removeEventListener });
    const update = vi.fn();

    const cleanup = subscribeToOnlineStatus(update);
    cleanup();

    expect(addEventListener).toHaveBeenCalledWith("online", update);
    expect(addEventListener).toHaveBeenCalledWith("offline", update);
    expect(removeEventListener).toHaveBeenCalledWith("online", update);
    expect(removeEventListener).toHaveBeenCalledWith("offline", update);
    vi.unstubAllGlobals();
  });

  it("provides distinct accessible Slovenian states and recovery controls", () => {
    const states = [
      renderToStaticMarkup(createElement(LoadingState)),
      renderToStaticMarkup(
        createElement(EmptyState, {
          title: "Ni zadetkov",
          description: "Poskusi znova.",
        }),
      ),
      renderToStaticMarkup(createElement(OfflineState, { onRetry: vi.fn() })),
      renderToStaticMarkup(
        createElement(PermissionDeniedState, { onRetry: vi.fn() }),
      ),
      renderToStaticMarkup(createElement(AuthenticationRequiredState)),
      renderToStaticMarkup(createElement(ErrorState, { onRetry: vi.fn() })),
    ].join("\n");

    expect(states).toContain('role="status"');
    expect(states).toContain('role="alert"');
    expect(states.match(/<button/g)).toHaveLength(3);
    expect(states).toContain("Trenutno si brez povezave");
    expect(states).toContain("Dostop do vsebine ni dovoljen");
    expect(states).toContain("Prijava je potrebna");
    expect(states).toContain("Ni zadetkov");
  });
});
