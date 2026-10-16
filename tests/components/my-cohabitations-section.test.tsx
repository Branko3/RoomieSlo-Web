import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ME = "11111111-1111-4111-8111-111111111111";
const PEER = "22222222-2222-4222-8222-222222222222";

type Row = Record<string, unknown>;

const fake = vi.hoisted(() => ({
  user: { id: "11111111-1111-4111-8111-111111111111" } as { id: string } | null,
  rows: [] as Row[],
  listError: null as unknown,
  available: true,
  updates: [] as unknown[],
}));

function profileRow() {
  return {
    id: ME,
    display_name: "Jaz",
    academic_status_verified: false,
    is_available: fake.available,
    created_at: "2026-01-01T00:00:00Z",
  };
}

vi.mock("../../lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: fake.user }, error: null }),
    },
    from: (table: string) => {
      if (table === "cohabitations")
        return {
          select: () => ({
            order: async () =>
              fake.listError
                ? { data: null, error: fake.listError }
                : { data: fake.rows, error: null },
          }),
        };
      return {
        select: (columns: string) =>
          columns === "id,display_name"
            ? {
                in: async () => ({
                  data: [{ id: PEER, display_name: "Ana" }],
                  error: null,
                }),
              }
            : {
                eq: () => ({
                  maybeSingle: async () => ({
                    data: profileRow(),
                    error: null,
                  }),
                }),
              },
        update: (values: { is_available: boolean }) => {
          fake.updates.push(values);
          fake.available = values.is_available;
          return {
            eq: () => ({
              select: () => ({
                maybeSingle: async () => ({ data: profileRow(), error: null }),
              }),
            }),
          };
        },
      };
    },
  }),
}));

const { MyCohabitationsSection } =
  await import("../../components/my-cohabitations-section");

function row(overrides: Row = {}): Row {
  return {
    id: "c1",
    match_id: "m1",
    user_id_a: ME,
    user_id_b: PEER,
    initiated_by: PEER,
    status: "active",
    started_month: "2026-09-01",
    ended_month: null,
    declined_at: null,
    confirmed_at: "2026-09-02T00:00:00Z",
    ended_at: null,
    version: 2,
    created_at: "2026-09-01T10:00:00Z",
    ...overrides,
  };
}

const suggestion = () =>
  screen.queryByRole("region", { name: /Ali želiš izklopiti/ });

function renderSection() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MyCohabitationsSection />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  fake.user = { id: ME };
  fake.rows = [];
  fake.listError = null;
  fake.available = true;
  fake.updates = [];
  window.localStorage.clear();
});

describe("MyCohabitationsSection", () => {
  it("lists my cohabitations, without declined declarations", async () => {
    fake.rows = [
      row(),
      row({
        id: "c0",
        match_id: "m0",
        status: "ended",
        started_month: "2025-10-01",
        ended_month: "2026-06-01",
      }),
      row({
        id: "cx",
        status: "declined",
        declined_at: "2026-10-01T00:00:00Z",
      }),
    ];
    fake.available = false;
    renderSection();

    expect(
      screen.getByRole("heading", { name: "Moje sobivanje" }),
    ).toBeInTheDocument();
    const items = await screen.findAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Ana");
    expect(items[0]).toHaveTextContent("Živita skupaj · od sep. 2026");
    expect(items[1]).toHaveTextContent(
      "Ne živita več skupaj · okt. 2025 – jun. 2026",
    );
    expect(
      within(items[0]).getByRole("link", { name: "Odpri klepet z osebo Ana" }),
    ).toHaveAttribute("href", "/chats/m1");
  });

  it("explains an empty list", async () => {
    renderSection();
    expect(
      await screen.findByText(/Še nimaš zabeleženega sobivanja/),
    ).toBeInTheDocument();
  });

  it("suggests turning off 'Iščem sostanovalca / sobo' once, and only on request", async () => {
    const user = userEvent.setup();
    fake.rows = [row()];
    const { unmount } = renderSection();

    const shown = await screen.findByRole("region", {
      name: /Ali želiš izklopiti »Iščem sostanovalca \/ sobo«/,
    });
    // Nothing is switched off automatically.
    expect(fake.updates).toEqual([]);
    await user.click(within(shown).getByRole("button", { name: "Izklopi" }));
    expect(fake.updates).toEqual([{ is_available: false }]);
    await waitFor(() => expect(suggestion()).toBeNull());
    unmount();

    // Turned back on later: the suggestion for this cohabitation is not shown again.
    fake.available = true;
    renderSection();
    await screen.findAllByRole("listitem");
    expect(suggestion()).toBeNull();
  });

  it("can be dismissed without changing availability", async () => {
    const user = userEvent.setup();
    fake.rows = [row()];
    renderSection();
    await user.click(await screen.findByRole("button", { name: "Ne zdaj" }));
    expect(suggestion()).toBeNull();
    expect(fake.updates).toEqual([]);
  });

  it("does not suggest anything when I am not looking or nothing is active", async () => {
    fake.rows = [row({ status: "pending" })];
    renderSection();
    expect(await screen.findByText(/Čaka na tvoj odgovor/)).toBeInTheDocument();
    expect(suggestion()).toBeNull();
  });

  it("shows load errors with a retry, and sign-in when signed out", async () => {
    const user = userEvent.setup();
    fake.listError = { code: "XX000", message: "boom" };
    const { unmount } = renderSection();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Podatkov o sobivanju ni bilo mogoče naložiti.",
    );
    fake.listError = null;
    await user.click(screen.getByRole("button", { name: "Poskusi znova" }));
    expect(
      await screen.findByText(/Še nimaš zabeleženega sobivanja/),
    ).toBeInTheDocument();
    unmount();

    fake.user = null;
    renderSection();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Za to dejanje se prijavi.",
    );
    expect(screen.getByRole("link", { name: "Prijava" })).toBeInTheDocument();
  });
});
