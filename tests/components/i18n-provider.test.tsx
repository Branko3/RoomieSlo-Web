import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({
  pathname: "/listings",
  refresh: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({
    refresh: navigation.refresh,
    replace: navigation.replace,
  }),
}));

vi.mock("../../components/auth-provider", () => ({
  useAuth: () => ({
    configured: true,
    pending: false,
    session: null,
    error: null,
    signOut: vi.fn(),
  }),
}));

vi.mock("../../lib/ops/report-error", () => ({ reportError: vi.fn() }));

import ErrorPage from "../../app/error";
import { AppShell } from "../../components/app-shell";
import { OfflineState } from "../../components/data-states";
import { catalogs } from "../../lib/i18n/messages";
import { I18nProvider, useI18n } from "../../lib/i18n/provider";

function inEnglish(ui: React.ReactNode) {
  return render(
    <I18nProvider locale="en" messages={catalogs.en}>
      {ui}
    </I18nProvider>,
  );
}

describe("I18nProvider", () => {
  it("renders the signed-in shell in English", () => {
    inEnglish(
      <AppShell>
        <p>Page</p>
      </AppShell>,
    );
    expect(screen.getByRole("link", { name: "Skip to content" })).toBeVisible();
    const main = screen.getByRole("navigation", { name: "Main navigation" });
    expect(
      within(main)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Listings", "Search", "Chats", "Favourites", "Profile"]);
    expect(
      within(main).getByRole("link", { name: "Listings" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("navigation", { name: "Mobile navigation" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeVisible();
    expect(screen.getByRole("group", { name: "Language" })).toBeVisible();
  });

  it("renders error pages and data states in English", () => {
    inEnglish(
      <>
        <ErrorPage error={new Error("boom")} reset={vi.fn()} />
        <OfflineState onRetry={vi.fn()} />
      </>,
    );
    expect(
      screen.getByRole("heading", { name: "Something went wrong" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "You're offline" }),
    ).toBeVisible();
    expect(screen.getAllByRole("button", { name: "Try again" })).toHaveLength(
      2,
    );
    expect(
      screen.getByRole("link", { name: "Go to listings" }),
    ).toHaveAttribute("href", "/listings");
  });

  it("exposes the locale, plural rules and formatters", () => {
    function Probe() {
      const { locale, plural, formatters, format, m } = useI18n();
      return (
        <p>
          {[
            locale,
            plural({ one: "{count} chat", other: "{count} chats" }, 2),
            formatters.currency(1250),
            format("{a}!", { a: m.shell.nav.chats }),
          ].join(" | ")}
        </p>
      );
    }
    inEnglish(<Probe />);
    expect(
      screen.getByText("en | 2 chats | €1,250 | Chats!"),
    ).toBeInTheDocument();
  });

  it("falls back to Slovenian without a provider in tests", () => {
    render(<OfflineState />);
    expect(
      screen.getByRole("heading", { name: "Trenutno si brez povezave" }),
    ).toBeVisible();
  });
});
