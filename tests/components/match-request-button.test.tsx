import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { catalogs } from "../../lib/i18n/messages";
import { I18nProvider } from "../../lib/i18n/provider";

const ME = "me";
const OWNER = "owner";

type Pair = {
  id: string;
  user_id_a: string;
  user_id_b: string;
  status: string;
};

const fake = vi.hoisted(() => ({
  user: { id: "me" } as { id: string } | null,
  pairs: [] as Pair[],
  insertError: null as { code: string } | null,
}));

vi.mock("../../lib/config", () => ({
  getSupabaseConfig: () => ({ configured: true, url: "u", anonKey: "k" }),
}));

vi.mock("../../lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: fake.user }, error: null }),
    },
    from: () => ({
      select: () => ({
        or: () => ({
          limit: async () => ({ data: fake.pairs, error: null }),
        }),
      }),
      insert: (row: { user_id_a: string; user_id_b: string }) => ({
        select: () => ({
          single: async () => {
            if (fake.insertError)
              return { data: null, error: fake.insertError };
            const pair = { id: "m1", ...row, status: "pending" };
            fake.pairs = [pair];
            return { data: pair, error: null };
          },
        }),
      }),
    }),
  }),
}));

const { MatchRequestButton } =
  await import("../../components/match-request-button");

function renderButton(ownerId = OWNER, locale?: "en") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const button = (
    <QueryClientProvider client={client}>
      <MatchRequestButton ownerId={ownerId} />
    </QueryClientProvider>
  );
  return render(
    locale ? (
      <I18nProvider locale={locale} messages={catalogs[locale]}>
        {button}
      </I18nProvider>
    ) : (
      button
    ),
  );
}

beforeEach(() => {
  fake.user = { id: ME };
  fake.pairs = [];
  fake.insertError = null;
});

describe("MatchRequestButton", () => {
  it("sends a request in Slovenian", async () => {
    renderButton();
    await userEvent.click(
      await screen.findByRole("button", { name: "Pošlji zahtevo za ujemanje" }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Zahteva je poslana.",
    );
    expect(screen.getByRole("link", { name: "Odpri klepete" })).toHaveAttribute(
      "href",
      "/chats",
    );
  });

  it("sends a request in English", async () => {
    renderButton(OWNER, "en");
    await userEvent.click(
      await screen.findByRole("button", { name: "Send a match request" }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Request sent.",
    );
    expect(
      screen.getByRole("link", { name: "Open chats" }),
    ).toBeInTheDocument();
  });

  it("describes an accepted request in English with a link to the chat", async () => {
    fake.pairs = [
      { id: "m9", user_id_a: OWNER, user_id_b: ME, status: "accepted" },
    ];
    renderButton(OWNER, "en");
    expect(await screen.findByRole("status")).toHaveTextContent(
      "You're already connected.",
    );
    expect(screen.getByRole("link", { name: "Open chat" })).toHaveAttribute(
      "href",
      "/chats/m9",
    );
  });

  it("recognises the owner's own listing in English", async () => {
    renderButton(ME, "en");
    expect(
      await screen.findByText("This is your listing."),
    ).toBeInTheDocument();
  });

  it("asks a signed-out visitor to sign in, in English", async () => {
    fake.user = null;
    renderButton(OWNER, "en");
    expect(
      await screen.findByRole("link", { name: "Sign in to send a request" }),
    ).toHaveAttribute("href", "/login");
  });

  it("explains a failed send in English", async () => {
    fake.insertError = { code: "XX000" };
    renderButton(OWNER, "en");
    await userEvent.click(
      await screen.findByRole("button", { name: "Send a match request" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't send the request.",
    );
  });
});
