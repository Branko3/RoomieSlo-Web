import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({
  user: { id: "me" } as { id: string } | null,
  summary: null as unknown,
  summaryError: null as unknown,
  updates: [] as unknown[],
  updateError: null as unknown,
}));

vi.mock("../../lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: fake.user }, error: null }),
    },
    rpc: async () =>
      fake.summaryError
        ? { data: null, error: fake.summaryError }
        : { data: fake.summary, error: null },
    from: () => ({
      update: (values: { show_roommate_ratings: boolean }) => ({
        eq: () => ({
          select: () => ({
            maybeSingle: async () => {
              if (fake.updateError)
                return { data: null, error: fake.updateError };
              fake.updates.push(values);
              return { data: values, error: null };
            },
          }),
        }),
      }),
    }),
  }),
}));

const { MyRatingsSection } =
  await import("../../components/my-ratings-section");

function renderSection() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MyRatingsSection />
    </QueryClientProvider>,
  );
}

const toggle = () =>
  screen.getByRole("button", { name: "Prikaži ocene sostanovalcev" });

beforeEach(() => {
  fake.user = { id: "me" };
  fake.summary = { state: "insufficient", count: 2, visible: true };
  fake.summaryError = null;
  fake.updates = [];
  fake.updateError = null;
});

describe("MyRatingsSection", () => {
  it("shows my count below the threshold, without content", async () => {
    renderSection();
    expect(
      await screen.findByText("2 oceni, prikazane bodo od 3 dalje"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Področja za izboljšanje")).toBeNull();
  });

  it("shows my summary with strengths and private improvements from 3 ratings", async () => {
    fake.summary = {
      state: "shown",
      total: 4,
      would_live_again: 3,
      strengths: [{ tag: "clean_tidy", count: 3 }],
      improvements: [
        { tag: "noise", count: 2 },
        { tag: "visitors", count: 1 },
      ],
      visible: true,
    };
    renderSection();
    expect(
      await screen.findByText("3 od 4 sostanovalcev bi spet živeli s to osebo"),
    ).toBeInTheDocument();
    expect(screen.getByText("Čist(a) in urejen(a) · 3")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Področja za izboljšanje" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Hrup · 2")).toBeInTheDocument();
    expect(screen.getByText("Obiski · 1")).toBeInTheDocument();
    expect(screen.getByText(/Nihče ne vidi, kdo je dal/)).toBeInTheDocument();
  });

  it("turns ratings off and on with an accessible toggle", async () => {
    const user = userEvent.setup();
    renderSection();
    await screen.findByText("2 oceni, prikazane bodo od 3 dalje");
    expect(toggle()).toHaveAttribute("aria-pressed", "true");

    await user.click(toggle());
    await waitFor(() =>
      expect(toggle()).toHaveAttribute("aria-pressed", "false"),
    );
    expect(fake.updates).toEqual([{ show_roommate_ratings: false }]);
    expect(
      screen.getByText(/Izklopljeno: ocene se zbirajo zasebno/),
    ).toBeInTheDocument();
    expect(toggle()).toHaveFocus();

    await user.keyboard("{Enter}");
    await waitFor(() =>
      expect(toggle()).toHaveAttribute("aria-pressed", "true"),
    );
    expect(fake.updates).toEqual([
      { show_roommate_ratings: false },
      { show_roommate_ratings: true },
    ]);
  });

  it("keeps the setting and explains a failed save", async () => {
    const user = userEvent.setup();
    fake.updateError = { message: "Failed to fetch" };
    renderSection();
    await screen.findByText("2 oceni, prikazane bodo od 3 dalje");
    await user.click(toggle());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Ni povezave. Preveri internet in poskusi znova.",
    );
    expect(toggle()).toHaveAttribute("aria-pressed", "true");
  });

  it("shows load errors with a retry, and sign-in when signed out", async () => {
    const user = userEvent.setup();
    fake.summaryError = { code: "XX000" };
    const { unmount } = renderSection();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Ocen ni bilo mogoče naložiti.",
    );
    fake.summaryError = null;
    await user.click(screen.getByRole("button", { name: "Poskusi znova" }));
    expect(
      await screen.findByText("2 oceni, prikazane bodo od 3 dalje"),
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
