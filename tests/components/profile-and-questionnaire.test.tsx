import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { catalogs } from "../../lib/i18n/messages";
import { I18nProvider } from "../../lib/i18n/provider";

const ME = "11111111-1111-4111-8111-111111111111";

const fake = vi.hoisted(() => ({
  answers: [] as Array<{ question_id: string; value: number; weight: number }>,
  upsertError: null as unknown,
  push: vi.fn(),
}));

function profileRow() {
  return {
    id: ME,
    display_name: "Ana Novak",
    faculty: "FRI",
    age: 22,
    bio: "",
    academic_status_verified: true,
    is_available: true,
    created_at: "2026-01-01T00:00:00Z",
  };
}

vi.mock("../../lib/config", () => ({
  getSupabaseConfig: () => ({ configured: true, url: "x", anonKey: "y" }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: fake.push }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("../../lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: ME } }, error: null }),
    },
    from: (table: string) =>
      table === "questionnaire_answers"
        ? {
            select: () => ({
              eq: async () => ({ data: fake.answers, error: null }),
            }),
            upsert: async () => ({ error: fake.upsertError }),
          }
        : {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: profileRow(), error: null }),
              }),
            }),
          },
  }),
}));

const { OwnProfileSection } =
  await import("../../components/own-profile-section");
const { AvailabilityCard, QuestionnaireProgressCard } =
  await import("../../components/profile-status-cards");
const { LifestyleQuestionnaire } =
  await import("../../components/lifestyle-questionnaire");

function renderIn(locale: "sl" | "en", ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <I18nProvider locale={locale} messages={catalogs[locale]}>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </I18nProvider>,
  );
}

beforeEach(() => {
  fake.answers = [];
  fake.upsertError = null;
  fake.push.mockReset();
});

describe("profile header", () => {
  it("shows the preview header in English", () => {
    renderIn("en", <OwnProfileSection configured={false} />);
    expect(
      screen.getByText("FRI, University of Ljubljana · 22 years old"),
    ).toBeInTheDocument();
    expect(screen.getByText("Verified student")).toBeInTheDocument();
  });

  it("keeps the Slovenian header and validation text unchanged", async () => {
    const user = userEvent.setup();
    renderIn("sl", <OwnProfileSection configured />);
    expect(await screen.findByText("FRI · 22 let")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Uredi" }));
    const name = screen.getByLabelText("Ime in priimek");
    await user.clear(name);
    await user.type(name, "a");
    await user.click(screen.getByRole("button", { name: "Shrani" }));
    expect(screen.getByText("Vnesi ime z vsaj 2 znakoma.")).toBeInTheDocument();
  });

  it("edits the profile in English", async () => {
    const user = userEvent.setup();
    renderIn("en", <OwnProfileSection configured />);
    expect(await screen.findByText("FRI · 22 years old")).toBeInTheDocument();
    expect(screen.getByText("Verified student")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(
      screen.getByRole("heading", { name: "Edit profile" }),
    ).toBeInTheDocument();
    const age = screen.getByLabelText("Age");
    await user.clear(age);
    await user.type(age, "17");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(
      screen.getByText("Age must be a whole number between 18 and 99."),
    ).toBeInTheDocument();
    expect(age).toHaveFocus();
    expect(age).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });
});

describe("profile status cards", () => {
  it("shows availability and questionnaire progress in English", async () => {
    fake.answers = [{ question_id: "q_noise", value: 0.75, weight: 0.0927 }];
    renderIn(
      "en",
      <>
        <AvailabilityCard />
        <QuestionnaireProgressCard />
      </>,
    );
    expect(
      await screen.findByText("Looking for a roommate / room"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Toggle availability" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      await screen.findByText("1 of 11 statements answered"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", { name: "Questionnaire completion" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Continue/ })).toHaveAttribute(
      "href",
      "/profile/questionnaire",
    );
  });

  it("keeps the Slovenian progress line", async () => {
    renderIn("sl", <QuestionnaireProgressCard />);
    expect(
      await screen.findByText("Izpolnjenih 0 od 11 trditev"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Začni/ })).toBeInTheDocument();
  });
});

describe("LifestyleQuestionnaire", () => {
  it("renders the statements and answers in English", async () => {
    renderIn("en", <LifestyleQuestionnaire />);
    expect(
      screen.getByRole("heading", { name: "Lifestyle questionnaire" }),
    ).toBeInTheDocument();
    const first = await screen.findByRole("group", {
      name: "1. Shared spaces should always be tidy.",
    });
    expect(
      within(first).getByRole("radio", { name: "Prefer not to say" }),
    ).toBeInTheDocument();
    expect(
      within(first).getByRole("radio", { name: "Strongly agree" }),
    ).toBeInTheDocument();
    expect(screen.getByText("0 of 11 statements answered")).toBeInTheDocument();
    expect(
      screen.getByRole("group", {
        name: "5. I like peace and quiet in the evening.",
      }),
    ).toBeInTheDocument();
  });

  it("shows a save error in English and saves the language-neutral rows", async () => {
    const user = userEvent.setup();
    fake.upsertError = { code: "42501" };
    renderIn("en", <LifestyleQuestionnaire />);
    await user.click(
      await screen.findByRole("button", { name: "Save and continue" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You don't have permission to save these answers. Sign in again.",
    );
    fake.upsertError = null;
    await user.click(screen.getByRole("button", { name: "Skip" }));
    expect(fake.push).toHaveBeenCalledWith("/profile");
  });

  it("keeps the Slovenian statements", async () => {
    renderIn("sl", <LifestyleQuestionnaire />);
    expect(
      await screen.findByRole("group", {
        name: "5. Zvečer imam rad(a) mir in tišino.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("radio", { name: "Ne želim odgovoriti" }),
    ).toHaveLength(11);
  });
});
