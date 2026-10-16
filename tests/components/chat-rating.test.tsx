import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addMonths, currentMonth } from "../../lib/cohabitation/months";

const ME = "11111111-1111-4111-8111-111111111111";
const PEER = "22222222-2222-4222-8222-222222222222";
const MATCH = "33333333-3333-4333-8333-333333333333";

type Row = Record<string, unknown>;

const fake = vi.hoisted(() => ({
  cohabitations: [] as Row[],
  rating: null as Row | null,
  rpc: vi.fn(),
}));

vi.mock("../../lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      getUser: async () => ({
        data: { user: { id: "11111111-1111-4111-8111-111111111111" } },
        error: null,
      }),
    },
    rpc: fake.rpc,
    from: (table: string) => ({
      select: () => ({
        eq: () =>
          table === "roommate_ratings"
            ? { maybeSingle: async () => ({ data: fake.rating, error: null }) }
            : {
                order: async () => ({ data: fake.cohabitations, error: null }),
              },
      }),
    }),
  }),
}));

const { ChatRating } = await import("../../components/chat-rating");

function cohabitation(overrides: Row = {}): Row {
  return {
    id: "c1",
    match_id: MATCH,
    user_id_a: ME,
    user_id_b: PEER,
    initiated_by: ME,
    status: "active",
    // Four months ago: the rating window is open.
    started_month: addMonths(currentMonth(), -4),
    ended_month: null,
    declined_at: null,
    confirmed_at: "2026-01-02T10:00:00Z",
    ended_at: null,
    version: 2,
    created_at: "2026-01-01T10:00:00Z",
    ...overrides,
  };
}

function rating(overrides: Row = {}): Row {
  return {
    id: "r1",
    cohabitation_id: "c1",
    rated_id: PEER,
    would_live_again: true,
    strengths: ["clean_tidy"],
    improvements: ["noise"],
    status: "hidden",
    submitted_at: new Date().toISOString(),
    revealed_at: null,
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function renderRating() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ChatRating matchId={MATCH} peerName="Ana" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  fake.cohabitations = [cohabitation()];
  fake.rating = null;
  fake.rpc.mockReset();
});

describe("ChatRating", () => {
  it("shows nothing without a confirmed cohabitation or before the window opens", async () => {
    fake.cohabitations = [
      cohabitation({ status: "pending", confirmed_at: null }),
    ];
    const { container, unmount } = renderRating();
    await new Promise((r) => setTimeout(r, 20));
    expect(container).toBeEmptyDOMElement();
    unmount();

    fake.cohabitations = [cohabitation({ started_month: currentMonth() })];
    const second = renderRating();
    await new Promise((r) => setTimeout(r, 20));
    expect(second.container).toBeEmptyDOMElement();
  });

  it("reminds when the window is open and submits a rating with the anonymity note", async () => {
    const user = userEvent.setup();
    fake.rpc.mockImplementation(async () => {
      fake.rating = rating({
        would_live_again: true,
        strengths: ["clean_tidy", "pleasant"],
        improvements: [],
      });
      return { data: fake.rating, error: null };
    });
    renderRating();

    expect(
      await screen.findByText("Lahko oceniš sobivanje z osebo Ana."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Oceni" }));
    const form = screen.getByRole("form", {
      name: "Ocena sobivanja z osebo Ana",
    });
    expect(
      within(form).getByText(
        "Ocena je anonimna in vidna šele, ko oceni tudi druga oseba ali po 14 dneh.",
      ),
    ).toBeInTheDocument();
    expect(within(form).getByRole("radio", { name: "Da" })).toHaveFocus();

    // Da/Ne is required.
    await user.click(within(form).getByRole("button", { name: "Oddaj oceno" }));
    expect(within(form).getByRole("alert")).toHaveTextContent(
      "Odgovori Da ali Ne.",
    );
    expect(fake.rpc).not.toHaveBeenCalled();

    await user.click(within(form).getByRole("radio", { name: "Da" }));
    await user.click(
      within(form).getByRole("checkbox", {
        name: "Prijeten/-tna sostanovalec/-ka",
      }),
    );
    await user.click(
      within(form).getByRole("checkbox", { name: "Čist(a) in urejen(a)" }),
    );
    await user.click(within(form).getByRole("button", { name: "Oddaj oceno" }));

    expect(fake.rpc).toHaveBeenCalledWith("submit_roommate_rating", {
      p_cohabitation_id: "c1",
      p_would_live_again: true,
      p_strengths: ["clean_tidy", "pleasant"],
      p_improvements: [],
    });
    expect(await screen.findByText("Ocena je shranjena.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Tvoja ocena: Da · Čist(a) in urejen(a), Prijeten/-tna sostanovalec/-ka",
      ),
    ).toBeInTheDocument();
  });

  it("allows at most 3 tags per set", async () => {
    const user = userEvent.setup();
    renderRating();
    await user.click(await screen.findByRole("button", { name: "Oceni" }));
    for (const name of ["Stroški", "Čistoča", "Hrup"])
      await user.click(screen.getByRole("checkbox", { name }));
    expect(screen.getByRole("checkbox", { name: "Obiski" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Hrup" })).toBeEnabled();
  });

  it("shows my hidden rating and lets me edit it, prefilled", async () => {
    const user = userEvent.setup();
    fake.rating = rating();
    renderRating();
    expect(
      await screen.findByText(
        "Tvoja ocena: Da · Čist(a) in urejen(a), Hrup (zasebno)",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/Tvoja ocena še ni vidna/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Uredi oceno" }));
    expect(screen.getByRole("radio", { name: "Da" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Hrup" })).toBeChecked();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("form")).toBeNull();
    expect(screen.getByRole("button", { name: "Uredi oceno" })).toHaveFocus();
  });

  it("locks a revealed rating until 6 months have passed", async () => {
    fake.rating = rating({
      status: "revealed",
      revealed_at: new Date().toISOString(),
    });
    renderRating();
    expect(
      await screen.findByText(/Oceno lahko posodobiš od/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("warns 7 days before the window closes", async () => {
    const endedAt = new Date(
      Date.now() - 55 * 24 * 60 * 60 * 1000,
    ).toISOString();
    fake.cohabitations = [
      cohabitation({
        status: "ended",
        ended_month: addMonths(currentMonth(), -2),
        ended_at: endedAt,
      }),
    ];
    renderRating();
    expect(await screen.findByText(/Ocenjevanje se zapre/)).toBeInTheDocument();
  });

  it("shows a server refusal", async () => {
    const user = userEvent.setup();
    fake.rpc.mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "rating window has closed" },
    });
    renderRating();
    await user.click(await screen.findByRole("button", { name: "Oceni" }));
    await user.click(screen.getByRole("radio", { name: "Ne" }));
    await user.click(screen.getByRole("button", { name: "Oddaj oceno" }));
    expect(
      await screen.findByText(
        "Ocenjevanje za to sobivanje trenutno ni odprto.",
      ),
    ).toBeInTheDocument();
  });
});
