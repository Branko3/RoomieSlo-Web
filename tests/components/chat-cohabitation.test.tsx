import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { currentMonth, monthLabel } from "../../lib/cohabitation/months";

const ME = "11111111-1111-4111-8111-111111111111";
const PEER = "22222222-2222-4222-8222-222222222222";
const MATCH = "33333333-3333-4333-8333-333333333333";

type Row = Record<string, unknown>;

const fake = vi.hoisted(() => ({
  user: { id: "11111111-1111-4111-8111-111111111111" } as { id: string } | null,
  rows: [] as Row[],
  listError: null as unknown,
  rpc: vi.fn(),
}));

vi.mock("../../lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: fake.user }, error: null }),
    },
    rpc: fake.rpc,
    from: () => ({
      select: () => ({
        eq: () => ({
          order: async () =>
            fake.listError
              ? { data: null, error: fake.listError }
              : { data: fake.rows, error: null },
        }),
      }),
    }),
  }),
}));

const { ChatCohabitation } = await import("../../components/chat-cohabitation");

function row(overrides: Row = {}): Row {
  return {
    id: "c1",
    match_id: MATCH,
    user_id_a: ME,
    user_id_b: PEER,
    initiated_by: ME,
    status: "pending",
    started_month: "2026-09-01",
    ended_month: null,
    declined_at: null,
    confirmed_at: null,
    ended_at: null,
    version: 1,
    created_at: "2026-10-10T10:00:00Z",
    ...overrides,
  };
}

function renderChat(props: { canDeclare?: boolean } = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ChatCohabitation
        matchId={MATCH}
        matchCreatedAt={new Date().toISOString()}
        peerName="Ana"
        canDeclare={props.canDeclare ?? true}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  fake.user = { id: ME };
  fake.rows = [];
  fake.listError = null;
  fake.rpc.mockReset();
});

describe("ChatCohabitation", () => {
  it("shows a loading state, then the declare action", async () => {
    renderChat();
    expect(screen.getByRole("status")).toHaveTextContent("Nalaganje sobivanja");
    expect(
      await screen.findByRole("button", { name: "Živiva skupaj" }),
    ).toBeInTheDocument();
  });

  it("declares with a month picker that focuses itself and closes on Escape", async () => {
    const user = userEvent.setup();
    const month = currentMonth();
    fake.rpc.mockImplementation(async () => {
      fake.rows = [row({ started_month: month })];
      return { data: fake.rows[0], error: null };
    });
    renderChat();

    const trigger = await screen.findByRole("button", {
      name: "Živiva skupaj",
    });
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const select = screen.getByLabelText("Mesec vselitve");
    expect(select).toHaveFocus();
    expect(
      screen.getByRole("option", { name: monthLabel(month) }),
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByLabelText("Mesec vselitve")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    await user.click(
      screen.getByRole("button", { name: "Pošlji v potrditev" }),
    );
    expect(fake.rpc).toHaveBeenCalledWith("declare_cohabitation", {
      p_match_id: MATCH,
      p_started_month: month,
    });
    expect(
      await screen.findByText(
        `Čakamo, da Ana potrdi, da živita skupaj od ${monthLabel(month)}.`,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Poslano v potrditev.")).toBeInTheDocument();
  });

  it("asks the other person to confirm, and shows the chip after Potrdi", async () => {
    const user = userEvent.setup();
    fake.user = { id: PEER };
    fake.rows = [row()];
    fake.rpc.mockImplementation(async () => {
      fake.rows = [row({ status: "active", version: 2 })];
      return { data: fake.rows[0], error: null };
    });
    renderChat();

    expect(
      await screen.findByText("Ana pravi, da živita skupaj od sep. 2026."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Potrdi" }));
    expect(fake.rpc).toHaveBeenCalledWith("respond_cohabitation", {
      p_id: "c1",
      p_confirm: true,
    });
    expect(
      await screen.findByText("Živita skupaj od sep. 2026"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ne živiva več skupaj" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Potrdi" })).toBeNull();
  });

  it("closes the declaration with Ne drži", async () => {
    const user = userEvent.setup();
    fake.user = { id: PEER };
    fake.rows = [row()];
    fake.rpc.mockImplementation(async () => {
      fake.rows = [
        row({ status: "declined", declined_at: new Date().toISOString() }),
      ];
      return { data: fake.rows[0], error: null };
    });
    renderChat();

    await user.click(await screen.findByRole("button", { name: "Ne drži" }));
    expect(fake.rpc).toHaveBeenCalledWith("respond_cohabitation", {
      p_id: "c1",
      p_confirm: false,
    });
    await waitFor(() =>
      expect(screen.queryByText(/pravi, da živita skupaj/)).toBeNull(),
    );
    // The one who declined sees no "Ni potrjeno"; they can declare themselves.
    expect(screen.queryByText("Ni potrjeno")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Živiva skupaj" }),
    ).toBeInTheDocument();
  });

  it("shows the declarer 'Ni potrjeno' without a reason, and the cooldown", async () => {
    fake.rows = [
      row({
        status: "declined",
        declined_at: new Date(Date.now() - 86_400_000).toISOString(),
      }),
    ];
    renderChat();
    expect(await screen.findByText("Ni potrjeno")).toBeInTheDocument();
    expect(screen.getByText(/Znova lahko predlagaš od/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Živiva skupaj" })).toBeNull();
  });

  it("ends an active cohabitation with an end month", async () => {
    const user = userEvent.setup();
    const month = currentMonth();
    fake.rows = [row({ status: "active", started_month: month })];
    fake.rpc.mockImplementation(async () => {
      fake.rows = [
        row({ status: "ended", started_month: month, ended_month: month }),
      ];
      return { data: fake.rows[0], error: null };
    });
    renderChat();

    expect(
      await screen.findByText(`Živita skupaj od ${monthLabel(month)}`),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Ne živiva več skupaj" }),
    );
    expect(screen.getByLabelText("Mesec izselitve")).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Potrdi konec" }));
    expect(fake.rpc).toHaveBeenCalledWith("end_cohabitation", {
      p_id: "c1",
      p_ended_month: month,
    });
    expect(
      await screen.findByText("Sobivanje je zaključeno."),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: "Živiva skupaj" }),
    ).toBeInTheDocument();
  });

  it("lets a blocked pair end, but not declare or confirm", async () => {
    fake.rows = [row({ status: "active" })];
    const { unmount } = renderChat({ canDeclare: false });
    expect(
      await screen.findByRole("button", { name: "Ne živiva več skupaj" }),
    ).toBeInTheDocument();
    unmount();

    fake.rows = [];
    renderChat({ canDeclare: false });
    await waitFor(() =>
      expect(screen.queryByText("Nalaganje sobivanja …")).toBeNull(),
    );
    expect(screen.queryByRole("button", { name: "Živiva skupaj" })).toBeNull();
  });

  it("shows a server refusal as an alert", async () => {
    const user = userEvent.setup();
    fake.user = { id: PEER };
    fake.rows = [row()];
    fake.rpc.mockResolvedValue({
      data: null,
      error: {
        code: "42501",
        message: "a block exists between the participants",
      },
    });
    renderChat();

    await user.click(await screen.findByRole("button", { name: "Potrdi" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Tega v tem klepetu zdaj ni mogoče narediti.",
    );
  });

  it("explains a conflict and shows the current state", async () => {
    const user = userEvent.setup();
    fake.user = { id: PEER };
    fake.rows = [row()];
    fake.rpc.mockImplementation(async () => {
      // The declarer's account was deleted meanwhile: the row is now declined.
      fake.rows = [
        row({ status: "declined", declined_at: new Date().toISOString() }),
      ];
      return {
        data: null,
        error: { code: "P0001", message: "cohabitation is no longer pending" },
      };
    });
    renderChat();

    await user.click(await screen.findByRole("button", { name: "Potrdi" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Stanje se je medtem spremenilo.",
    );
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Potrdi" })).toBeNull(),
    );
  });

  it("offers a retry when loading fails, and sign-in when signed out", async () => {
    const user = userEvent.setup();
    fake.listError = { message: "Failed to fetch" };
    const { unmount } = renderChat();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Ni povezave. Preveri internet in poskusi znova.",
    );
    fake.listError = null;
    await user.click(screen.getByRole("button", { name: "Poskusi znova" }));
    expect(
      await screen.findByRole("button", { name: "Živiva skupaj" }),
    ).toBeInTheDocument();
    unmount();

    fake.user = null;
    renderChat();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Za to dejanje se prijavi.",
    );
    expect(screen.getByRole("link", { name: "Prijava" })).toHaveAttribute(
      "href",
      "/login",
    );
  });
});
