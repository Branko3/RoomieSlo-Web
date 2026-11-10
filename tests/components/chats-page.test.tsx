import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Locale } from "../../lib/i18n/config";
import { createI18n } from "../../lib/i18n/i18n";
import { catalogs } from "../../lib/i18n/messages";
import { I18nProvider } from "../../lib/i18n/provider";

const request = vi.hoisted(() => ({ locale: "sl" as Locale }));

vi.mock("../../lib/i18n/server", () => ({
  getI18n: async () => createI18n(request.locale, catalogs[request.locale]),
}));

// Without Supabase the request panel renders nothing; it has its own tests.
vi.mock("../../lib/config", () => ({
  getSupabaseConfig: () => ({ configured: false }),
}));

const { default: ChatsPage } = await import("../../app/chats/page");

async function renderPage(locale: Locale) {
  request.locale = locale;
  render(
    <QueryClientProvider client={new QueryClient()}>
      <I18nProvider locale={locale} messages={catalogs[locale]}>
        {await ChatsPage()}
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe("Chats page", () => {
  it("renders in Slovenian", async () => {
    await renderPage("sl");
    expect(
      screen.getByRole("heading", { name: "Ujemanja in klepeti" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Poglej" })).toHaveAttribute(
      "href",
      "/recommendations",
    );
  });

  it("renders in English", async () => {
    await renderPage("en");
    expect(
      screen.getByRole("heading", { name: "Matches and chats" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Recommended profiles")).toBeInTheDocument();
    expect(screen.getByText("Based on your answers")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View" })).toHaveAttribute(
      "href",
      "/recommendations",
    );
  });
});
