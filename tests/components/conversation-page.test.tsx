import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { catalogs } from "../../lib/i18n/messages";
import { I18nProvider } from "../../lib/i18n/provider";

const ME = "me";
const PEER = "peer";
const MATCH = "33333333-3333-4333-8333-333333333333";

const fake = vi.hoisted(() => ({
  user: { id: "me" } as { id: string } | null,
  match: null as Record<string, unknown> | null,
  peer: null as Record<string, unknown> | null,
  listings: [] as Array<Record<string, unknown>>,
}));

vi.mock("../../lib/config", () => ({
  getSupabaseConfig: () => ({ configured: true, url: "u", anonKey: "k" }),
}));

vi.mock("../../lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: fake.user }, error: null }),
    },
    from: (table: string) => {
      const single = (data: unknown) => async () => ({ data, error: null });
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: async () => ({ data: fake.listings, error: null }),
        maybeSingle:
          table === "matches"
            ? single(fake.match)
            : table === "profiles"
              ? single(fake.peer)
              : single(null),
      };
      return chain;
    },
  }),
}));

const { default: ConversationPage } =
  await import("../../app/chats/[matchId]/page");

function renderPage(matchId = MATCH, locale?: "en") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const page = (
    <QueryClientProvider client={client}>
      <ConversationPage params={{ matchId }} />
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
  fake.user = { id: ME };
  fake.match = {
    id: MATCH,
    user_id_a: ME,
    user_id_b: PEER,
    status: "pending",
    created_at: "2026-10-01T00:00:00Z",
  };
  fake.peer = {
    id: PEER,
    display_name: "Ana",
    academic_status_verified: true,
    faculty: "FRI",
    deleted_at: null,
  };
  fake.listings = [
    {
      id: "l1",
      owner_id: PEER,
      location: "Ljubljana",
      price_per_month: 350,
      description: "",
      is_filled: false,
      version: 1,
      created_at: "2026-10-01T00:00:00Z",
      title: "Soba",
      room_type: "soba",
      district: "Center",
      available_from: null,
      size_sqm: null,
      deposit: null,
      bills_included: false,
      furnished: false,
      flatmates_count: 0,
      photo_url: "",
    },
  ];
});

describe("Conversation page", () => {
  it("renders a pending request in Slovenian", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: /Ana/ })).toBeVisible();
    expect(screen.getByText(/Zahteva še čaka na odgovor/)).toBeInTheDocument();
    expect(screen.getByText(/350 € \/ mesec/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Varnost: prijavi ali blokiraj" }),
    ).toBeInTheDocument();
  });

  it("renders a pending request in English", async () => {
    renderPage(MATCH, "en");
    expect(await screen.findByRole("heading", { name: /Ana/ })).toBeVisible();
    expect(screen.getByLabelText("Verified student")).toBeInTheDocument();
    expect(
      screen.getByText(/The request is still waiting for a reply/),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open requests" })).toHaveAttribute(
      "href",
      "/chats",
    );
    expect(
      screen.getByRole("region", { name: "This person's listings" }),
    ).toHaveTextContent("Center · €350 / month");
    expect(
      screen.getByRole("button", { name: "Safety: report or block" }),
    ).toBeInTheDocument();
    // The safety panel is closed (hidden) until the menu is opened.
    expect(
      screen.getByRole("link", { name: "Report", hidden: true }),
    ).toHaveAttribute("href", `/report/${PEER}?from=chat&match=${MATCH}`);
    expect(
      screen.getByRole("button", { name: "Block", hidden: true }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back to chats/ })).toBeVisible();
  });

  it("uses a neutral English name for a person without one", async () => {
    fake.peer = { ...fake.peer, display_name: null };
    renderPage(MATCH, "en");
    expect(await screen.findByRole("heading", { name: /^User/ })).toBeVisible();
  });

  it("explains a missing conversation in English", async () => {
    renderPage("not-a-match", "en");
    expect(
      await screen.findByRole("heading", { name: "Chat not available" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to chats" })).toBeVisible();
  });

  it("asks a signed-out visitor to sign in, in English", async () => {
    fake.user = null;
    renderPage(MATCH, "en");
    expect(
      await screen.findByRole("heading", { name: "You're not signed in" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login",
    );
  });
});
