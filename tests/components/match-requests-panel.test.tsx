import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MatchRecord } from "../../lib/matching/match-requests";

const ME = "me";

const fake = vi.hoisted(() => ({
  matches: [] as MatchRecord[],
  names: [] as Array<{ id: string; display_name: string }>,
  rpc: vi.fn(),
  updates: [] as unknown[],
  cohabitations: [] as Array<Record<string, unknown>>,
}));

vi.mock("../../lib/config", () => ({
  getSupabaseConfig: () => ({ configured: true, url: "u", anonKey: "k" }),
}));

vi.mock("../../lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: ME } }, error: null }),
    },
    rpc: fake.rpc,
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            in: async () => ({ data: fake.names, error: null }),
          }),
        };
      }
      if (table === "cohabitations") {
        return {
          select: () => ({
            order: async () => ({ data: fake.cohabitations, error: null }),
          }),
        };
      }
      if (table === "messages") {
        // Delivery markers (Android chat list); answered, but not under test here.
        const chain = {
          update: () => chain,
          eq: () => chain,
          neq: () => chain,
          then: (resolve: (value: { error: null }) => unknown) =>
            resolve({ error: null }),
        };
        return chain;
      }
      return {
        select: () => ({
          or: () => ({
            order: async () => ({ data: fake.matches, error: null }),
          }),
        }),
        update: (values: unknown) => {
          fake.updates.push(values);
          const chain = {
            eq: () => chain,
            select: async () => ({
              data: [{ id: "m-in", status: "rejected" }],
              error: null,
            }),
          };
          return chain;
        },
      };
    },
  }),
}));

const { MatchRequestsPanel } =
  await import("../../components/match-requests-panel");

function match(overrides: Partial<MatchRecord>): MatchRecord {
  return {
    id: "m",
    user_id_a: ME,
    user_id_b: "peer",
    status: "pending",
    version: 1,
    created_at: "2026-10-01T00:00:00Z",
    ...overrides,
  };
}

function renderPanel() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MatchRequestsPanel />
    </QueryClientProvider>,
  );
}

const row = (name: string) =>
  screen.getByText(name).closest("li") as HTMLElement;

beforeEach(() => {
  fake.rpc.mockReset();
  fake.updates = [];
  fake.cohabitations = [];
  fake.matches = [
    match({ id: "m-in", user_id_a: "ana", user_id_b: ME }),
    match({ id: "m-out", user_id_a: ME, user_id_b: "bor" }),
    match({ id: "m-ok", user_id_a: ME, user_id_b: "cene", status: "accepted" }),
  ];
  fake.names = [
    { id: "ana", display_name: "Ana" },
    { id: "bor", display_name: "Bor" },
    { id: "cene", display_name: "Cene" },
  ];
});

describe("MatchRequestsPanel", () => {
  it("shows answer buttons only on requests sent to me", async () => {
    renderPanel();
    await screen.findByText("Ana");
    expect(
      within(row("Ana")).getByRole("button", { name: "Sprejmi" }),
    ).toBeInTheDocument();
    expect(within(row("Ana")).getByText("Nova zahteva za ujemanje"));
    expect(within(row("Bor")).queryByRole("button")).toBeNull();
    expect(within(row("Bor")).getByText("Čaka na odgovor"));
  });

  it("links accepted matches to their conversation", async () => {
    renderPanel();
    const link = await screen.findByRole("link", { name: "Odpri klepet" });
    expect(link).toHaveAttribute("href", "/chats/m-ok");
    expect(row("Cene")).toContainElement(link);
  });

  it("marks a chat whose cohabitation declaration awaits my answer", async () => {
    const declaration = {
      id: "c1",
      match_id: "m-ok",
      user_id_a: ME,
      user_id_b: "cene",
      initiated_by: "cene",
      status: "pending",
      started_month: "2026-09-01",
      ended_month: null,
      declined_at: null,
      confirmed_at: null,
      ended_at: null,
      version: 1,
      created_at: "2026-10-10T10:00:00Z",
    };
    fake.cohabitations = [declaration];
    renderPanel();
    await screen.findByText("Cene");
    expect(
      await within(row("Cene")).findByText("Čaka na tvoj odgovor o sobivanju"),
    ).toBeInTheDocument();
    expect(within(row("Ana")).queryByText(/sobivanju/)).toBeNull();
  });

  it("does not mark my own pending declaration", async () => {
    fake.cohabitations = [
      {
        id: "c1",
        match_id: "m-ok",
        user_id_a: ME,
        user_id_b: "cene",
        initiated_by: ME,
        status: "pending",
        started_month: "2026-09-01",
        ended_month: null,
        declined_at: null,
        confirmed_at: null,
        ended_at: null,
        version: 1,
        created_at: "2026-10-10T10:00:00Z",
      },
    ];
    renderPanel();
    await screen.findByText("Cene");
    expect(screen.queryByText("Čaka na tvoj odgovor o sobivanju")).toBeNull();
  });

  it("accepts through the atomic RPC and shows the new state", async () => {
    fake.rpc.mockImplementation(async () => {
      // The server state changes too, so the refetch after success agrees.
      const accepted = match({
        id: "m-in",
        user_id_a: "ana",
        user_id_b: ME,
        status: "accepted",
        version: 2,
      });
      fake.matches = [accepted, ...fake.matches.slice(1)];
      return { data: accepted, error: null };
    });
    renderPanel();
    await screen.findByText("Ana");
    await userEvent.click(
      within(row("Ana")).getByRole("button", { name: "Sprejmi" }),
    );
    expect(fake.rpc).toHaveBeenCalledWith("accept_match", {
      p_match_id: "m-in",
    });
    expect(
      await within(row("Ana")).findByText("Sprejeto — odpri klepet"),
    ).toBeInTheDocument();
  });

  it("rejects with a status-only update", async () => {
    renderPanel();
    await screen.findByText("Ana");
    await userEvent.click(
      within(row("Ana")).getByRole("button", { name: "Zavrni" }),
    );
    expect(fake.updates).toEqual([{ status: "rejected" }]);
    expect(fake.rpc).not.toHaveBeenCalled();
  });

  it("shows the conflict message when the request was already handled", async () => {
    fake.rpc.mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "match is unavailable" },
    });
    renderPanel();
    await screen.findByText("Ana");
    await userEvent.click(
      within(row("Ana")).getByRole("button", { name: "Sprejmi" }),
    );
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("explains an empty list", async () => {
    fake.matches = [];
    renderPanel();
    expect(
      await screen.findByText(/Še nimaš zahtev za ujemanje/),
    ).toBeInTheDocument();
  });
});
