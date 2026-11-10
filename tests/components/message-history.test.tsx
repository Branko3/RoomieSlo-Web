import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Row } from "../../lib/supabase/types";
import { catalogs } from "../../lib/i18n/messages";
import { I18nProvider } from "../../lib/i18n/provider";

const ME = "me";
const PEER = "peer";

const fake = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
}));

vi.mock("../../lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: ME } }, error: null }),
    },
    from: () => {
      // Read markers (markRead) chain through update/eq/neq and resolve.
      const chain = {
        select: () => chain,
        update: () => chain,
        eq: () => chain,
        neq: () => chain,
        order: async () => ({ data: fake.rows, error: null }),
        then: (resolve: (value: { error: null }) => unknown) =>
          resolve({ error: null }),
      };
      return chain;
    },
  }),
}));

const { MessageHistory } = await import("../../components/message-history");

function message(
  id: string,
  sender: string,
  sentAt: string,
  status: Row<"messages">["delivery_status"] = "sent",
): Row<"messages"> {
  return {
    id,
    match_id: "m1",
    sender_id: sender,
    body: `Body ${id}`,
    delivery_status: status,
    sent_at: sentAt,
  };
}

function renderHistory(locale?: "en") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const history = (
    <QueryClientProvider client={client}>
      <MessageHistory matchId="m1" peerName="Ana" />
    </QueryClientProvider>
  );
  return render(
    locale ? (
      <I18nProvider locale={locale} messages={catalogs[locale]}>
        {history}
      </I18nProvider>
    ) : (
      history
    ),
  );
}

beforeEach(() => {
  // jsdom has no layout; the history scrolls its end into view.
  Element.prototype.scrollIntoView = vi.fn();
  // 10:00 UTC is 12:00 in Ljubljana (CEST); the old day is a Monday.
  fake.rows = [
    message("a", PEER, "2026-10-05T10:00:00Z", "read"),
    message("b", ME, "2026-10-05T10:05:00Z", "read"),
    message("c", ME, "2026-10-05T10:06:00Z", "delivered"),
  ];
});

describe("MessageHistory", () => {
  it("renders days, times and delivery states in Slovenian", async () => {
    renderHistory();
    const log = await screen.findByRole("log", {
      name: "Sporočila z osebo Ana",
    });
    expect(within(log).getByText("ponedeljek, 5. oktober")).toBeInTheDocument();
    expect(within(log).getByText("12:05")).toBeInTheDocument();
    expect(within(log).getByText("Prebrano", { exact: false }));
    expect(within(log).getByText("Dostavljeno", { exact: false }));
  });

  it("renders in English", async () => {
    renderHistory("en");
    const log = await screen.findByRole("log", { name: "Messages with Ana" });
    expect(within(log).getByText("Monday 5 October")).toBeInTheDocument();
    expect(within(log).getByText("12:05")).toBeInTheDocument();
    expect(within(log).getByText("Read", { exact: false }));
    expect(within(log).getByText("Delivered", { exact: false }));
    expect(within(log).getAllByText("You:", { exact: false })).toHaveLength(2);
  });

  it("invites the first message in English", async () => {
    fake.rows = [];
    renderHistory("en");
    expect(
      await screen.findByText("No messages yet. Say hello to Ana."),
    ).toBeInTheDocument();
  });
});
