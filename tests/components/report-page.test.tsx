import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { catalogs } from "../../lib/i18n/messages";
import { I18nProvider } from "../../lib/i18n/provider";

const ME = "11111111-1111-4111-8111-111111111111";
const PEER = "22222222-2222-4222-8222-222222222222";

const fake = vi.hoisted(() => ({
  rpc: vi.fn(),
  user: { id: "11111111-1111-4111-8111-111111111111" } as { id: string } | null,
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("from=listing&listing=l1"),
}));

vi.mock("../../lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: fake.user }, error: null }),
    },
    rpc: fake.rpc,
  }),
}));

const { default: ReportPage } = await import("../../app/report/[userId]/page");

function renderPage(userId: string, locale?: "en") {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const page = (
    <QueryClientProvider client={client}>
      <ReportPage params={{ userId }} />
    </QueryClientProvider>
  );
  return render(
    locale ? (
      <I18nProvider locale={locale} messages={catalogs[locale]}>
        {page}
      </I18nProvider>
    ) : (
      page
    ),
  );
}

beforeEach(() => {
  fake.rpc.mockReset();
  fake.rpc.mockResolvedValue({ data: "r1", error: null });
  fake.user = { id: ME };
});

describe("Report page", () => {
  it("shows the stored Slovenian reasons as labels in Slovenian", () => {
    renderPage(PEER);
    expect(
      screen.getByRole("heading", { name: "Prijavi oglas" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: "Neprimerna vsebina" }),
    ).toBeChecked();
    expect(
      screen.getByRole("radio", { name: "Nadlegovanje" }),
    ).toBeInTheDocument();
  });

  it("translates the reasons in English but stores the Slovenian value", async () => {
    renderPage(PEER, "en");
    expect(
      screen.getByRole("heading", { name: "Report listing" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: "Inappropriate content" }),
    ).toBeChecked();
    await userEvent.click(screen.getByRole("radio", { name: "Harassment" }));
    await userEvent.click(screen.getByRole("button", { name: "Send report" }));
    expect(
      await screen.findByRole("heading", { name: "Report sent" }),
    ).toBeInTheDocument();
    expect(fake.rpc).toHaveBeenCalledWith(
      "submit_report",
      expect.objectContaining({
        p_reported: PEER,
        p_reason: "Nadlegovanje",
        // The admins' context note stays Slovenian, whatever the language.
        p_description: "[Prijava iz oglasa: l1]",
      }),
    );
  });

  it("explains errors in English, with a sign-in link when signed out", async () => {
    fake.user = null;
    renderPage(PEER, "en");
    await userEvent.click(screen.getByRole("button", { name: "Send report" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sign in to your account to send a report.",
    );
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("refuses an invalid user id in English", () => {
    renderPage("not-a-user", "en");
    expect(
      screen.getByRole("heading", { name: "Can't send a report" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Invalid user.")).toBeInTheDocument();
  });
});
