import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Listing } from "../../lib/supabase/mappers";

const hook = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
  setFilled: vi.fn(),
  refetch: vi.fn(),
}));

vi.mock("../../lib/listings/use-my-listings", () => ({
  useMyListings: () => ({
    ...hook.state,
    setFilled: hook.setFilled,
    refetch: hook.refetch,
  }),
}));

// The status toggle persists through Supabase; the update confirms the new value.
vi.mock("../../lib/supabase/browser", () => {
  const chain = {
    update: () => chain,
    eq: () => chain,
    select: () => chain,
    maybeSingle: async () => ({
      data: { id: "a", is_filled: true },
      error: null,
    }),
  };
  return {
    createSupabaseBrowserClient: () => ({
      auth: { getUser: async () => ({ data: { user: { id: "me" } } }) },
      from: () => chain,
    }),
  };
});

import MyListingsPage from "../../app/listings/mine/page";

function listing(id: string, overrides: Partial<Listing> = {}): Listing {
  return {
    id,
    ownerId: "me",
    title: `Soba ${id}`,
    district: "Center",
    location: "Ljubljana",
    price: 300,
    available: "po dogovoru",
    availableFrom: null,
    roomType: "soba",
    details: "",
    image: "",
    isFilled: false,
    createdAt: "2026-10-19T08:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  hook.state = {};
});

describe("Moji oglasi", () => {
  it("announces loading with listing-shaped placeholders", () => {
    hook.state = { isPending: true };
    render(<MyListingsPage />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Nalaganje tvojih oglasov ...",
    );
  });

  it("offers a retry when loading fails", async () => {
    hook.state = {
      isPending: false,
      error: new Error("boom"),
      data: undefined,
    };
    render(<MyListingsPage />);
    await userEvent.click(
      screen.getByRole("button", { name: "Poskusi znova" }),
    );
    expect(hook.refetch).toHaveBeenCalled();
  });

  it("invites the user to post when there is nothing yet", () => {
    hook.state = { isPending: false, error: null, data: [] };
    render(<MyListingsPage />);
    expect(
      screen.getByRole("heading", { name: "Še nimaš oglasov" }),
    ).toBeInTheDocument();
    const postLinks = screen.getAllByRole("link", { name: "Objavi oglas" });
    expect(
      postLinks.every((link) => link.getAttribute("href") === "/listings/new"),
    ).toBe(true);
  });

  it("lists available and filled listings with their status and owner actions", () => {
    hook.state = {
      isPending: false,
      error: null,
      data: [listing("a"), listing("b", { isFilled: true })],
    };
    render(<MyListingsPage />);
    expect(
      screen.getByText("1 aktiven oglas, 1 zapolnjen"),
    ).toBeInTheDocument();

    const [available, filled] = screen.getAllByRole("article");
    expect(within(available).getByText("Na voljo")).toBeInTheDocument();
    expect(
      within(available).getByRole("link", { name: "Soba a" }),
    ).toHaveAttribute("href", "/listings/a");
    expect(
      within(available).getByRole("link", { name: "Uredi oglas Soba a" }),
    ).toHaveAttribute("href", "/listings/a/edit");
    expect(
      within(available).getByRole("button", { name: "Označi kot zapolnjeno" }),
    ).toBeInTheDocument();

    expect(within(filled).getByText("Zapolnjeno")).toBeInTheDocument();
    expect(
      within(filled).getByRole("button", { name: "Označi kot na voljo" }),
    ).toBeInTheDocument();
    // Own listings carry no favourite heart.
    expect(screen.queryByRole("button", { name: /priljubljen/ })).toBeNull();
  });

  it("updates a listing's status in place when the owner toggles it", async () => {
    hook.state = { isPending: false, error: null, data: [listing("a")] };
    render(<MyListingsPage />);
    await userEvent.click(
      screen.getByRole("button", { name: "Označi kot zapolnjeno" }),
    );
    await waitFor(() => expect(hook.setFilled).toHaveBeenCalledWith("a", true));
  });
});
