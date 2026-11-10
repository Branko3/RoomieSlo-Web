import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { catalogs } from "../../lib/i18n/messages";
import { I18nProvider } from "../../lib/i18n/provider";

const fake = vi.hoisted(() => ({
  invoke: vi.fn(),
}));

vi.mock("../../lib/config", () => ({
  getSupabaseConfig: () => ({ configured: true, url: "u", anonKey: "k" }),
}));

vi.mock("../../lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "me" } }, error: null }),
    },
    functions: { invoke: fake.invoke },
  }),
}));

const { default: RecommendationsPage } =
  await import("../../app/recommendations/page");

const answers = ["q1", "q2", "q3"].map((question_id) => ({
  question_id,
  value: 1,
  weight: 1,
}));

function profile(id: string, extra = {}) {
  return {
    id,
    displayName: `Oseba ${id}`,
    verified: true,
    available: true,
    age: 22,
    faculty: "FRI",
    bio: "",
    ...extra,
  };
}

function renderPage(locale?: "en") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const page = (
    <QueryClientProvider client={client}>
      <RecommendationsPage />
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
  fake.invoke.mockReset();
  fake.invoke.mockResolvedValue({
    data: {
      myAnswers: answers,
      recommendations: [
        {
          profile: profile("a"),
          compatibility: 87,
          sharedStatements: 3,
          ratings: null,
        },
        {
          profile: profile("b", { verified: false }),
          compatibility: 0,
          sharedStatements: 0,
          ratings: null,
        },
      ],
    },
    error: null,
  });
});

describe("Recommendations page", () => {
  it("renders in Slovenian", async () => {
    renderPage();
    expect(await screen.findByText("Oseba a, 22")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Priporočeni profili" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Združljivost 87 %")).toHaveTextContent("87%");
    expect(screen.getByText("Preverjen študent")).toBeInTheDocument();
  });

  it("renders in English", async () => {
    renderPage("en");
    expect(await screen.findByText("Oseba a, 22")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Recommended profiles" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Compatibility 87%")).toBeInTheDocument();
    expect(
      screen.getByLabelText(
        "Compatibility can't be calculated: no shared answers",
      ),
    ).toHaveAttribute("title", "No shared questionnaire answers");
    expect(screen.getByText("Verified student")).toBeInTheDocument();
    expect(screen.getAllByText("Looking for a roommate")).toHaveLength(2);
  });

  it("explains a failure in English", async () => {
    fake.invoke.mockResolvedValue({
      data: null,
      error: { name: "FunctionsFetchError", message: "Failed to send" },
    });
    renderPage("en");
    expect(
      await screen.findByText("No connection. Couldn't load recommendations."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Couldn't load recommendations" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeEnabled();
  });

  it("shows an English empty state", async () => {
    fake.invoke.mockResolvedValue({
      data: { myAnswers: answers, recommendations: [] },
      error: null,
    });
    renderPage("en");
    expect(
      await screen.findByText("No profiles to recommend yet."),
    ).toBeInTheDocument();
  });
});
