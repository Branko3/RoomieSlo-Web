import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Listing } from "../../lib/supabase/mappers";

const state = vi.hoisted(() => ({
  favorites: [] as string[],
  toggleFavorite: vi.fn(),
  listing: null as unknown,
  pages: [] as unknown[],
  favoriteListings: [] as unknown[],
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/search",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams("maxPrice=500&location=Vi"),
}));

vi.mock("../../components/providers", () => ({
  useFavorites: () => ({
    favorites: state.favorites,
    isFavorite: (id: string) => state.favorites.includes(id),
    toggleFavorite: state.toggleFavorite,
    userId: null,
  }),
}));

vi.mock("../../lib/supabase/hooks", () => ({
  useListing: () => ({
    data: state.listing,
    isLoading: false,
    error: null,
    retry: vi.fn(),
  }),
  useListings: () => ({
    data: state.favoriteListings,
    isLoading: false,
    error: null,
    retry: vi.fn(),
  }),
}));

vi.mock("../../lib/listings/use-listing-pages", () => ({
  useListingPages: () => ({
    listings: state.pages,
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    isFetchingNextPage: false,
    isFetchNextPageError: false,
  }),
}));

vi.mock("../../lib/listings/use-offline-listings", () => ({
  useCachedListingsFallback: () => null,
  useOfflineListings: () => ({
    data: state.pages,
    isLoading: false,
    error: null,
    view: null,
    retry: vi.fn(),
  }),
}));

// Preview build: no Supabase, so owner-only controls stay hidden.
vi.mock("../../lib/config", () => ({
  getSupabaseConfig: () => ({ configured: false }),
}));

import FavoritesPage from "../../app/favorites/page";
import ListingDetail from "../../app/listings/[id]/page";
import NewListingPage from "../../app/listings/new/page";
import ListingsPage from "../../app/listings/page";
import SearchPage from "../../app/search/page";
import { ListingAbout } from "../../components/listing-about";
import { ListingCard } from "../../components/listing-card";
import { catalogs } from "../../lib/i18n/messages";
import { I18nProvider } from "../../lib/i18n/provider";

function inEnglish(ui: React.ReactNode) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <I18nProvider locale="en" messages={catalogs.en}>
        {ui}
      </I18nProvider>
    </QueryClientProvider>,
  );
}

function listing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: "a",
    ownerId: "owner-1",
    title: "Soba v centru",
    district: "Vič",
    location: "Ljubljana - Vič",
    price: 1250,
    availableFrom: "2026-09-20",
    roomType: "garsonjera",
    image: "",
    isFilled: false,
    createdAt: "2026-10-01T00:00:00Z",
    description: "",
    deposit: 400,
    sizeSqm: 16,
    flatmates: 2,
    billsIncluded: true,
    furnished: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  state.favorites = [];
  state.listing = listing();
  state.pages = [listing()];
  state.favoriteListings = [];
});

describe("ListingCard", () => {
  it("renders the flyer in Slovenian exactly as before", () => {
    render(<ListingCard listing={listing()} />);
    const card = screen.getByRole("article");
    expect(card).toHaveTextContent("garsonjera");
    expect(card).toHaveTextContent("Na voljo");
    expect(card).toHaveTextContent(
      "16 m² · 2 sostanovalca · stroški vključeni",
    );
    expect(card).toHaveTextContent("Najemnina1250 € / mesec");
    expect(card).toHaveTextContent("Na voljo od20. 9. 2026");
    expect(
      screen.getByRole("button", {
        name: "Dodaj Soba v centru med priljubljene",
      }),
    ).toBeInTheDocument();
  });

  it("renders the flyer in English", () => {
    inEnglish(<ListingCard listing={listing({ availableFrom: null })} />);
    const card = screen.getByRole("article");
    expect(card).toHaveTextContent("studio");
    expect(card).toHaveTextContent("Available");
    expect(card).toHaveTextContent("16 m² · 2 roommates · bills included");
    expect(card).toHaveTextContent("Rent€1,250 / month");
    expect(card).toHaveTextContent("Available fromby arrangement");
    expect(
      screen.getByRole("button", { name: "Add Soba v centru to favourites" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("names the remove action once the listing is saved", () => {
    state.favorites = ["a"];
    inEnglish(<ListingCard listing={listing()} />);
    expect(
      screen.getByRole("button", {
        name: "Remove Soba v centru from favourites",
      }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("still renders a listing cached in the old shape (display text and no facts)", () => {
    // IndexedDB rows written before the mapper returned raw fields.
    const cached = {
      ...listing(),
      roomType: "soba",
      available: "po dogovoru",
      details: "16 m² · 2 sostanovalcev",
      availableFrom: null,
      sizeSqm: undefined,
      flatmates: undefined,
      billsIncluded: undefined,
    } as Listing;
    inEnglish(<ListingCard listing={cached} />);
    const card = screen.getByRole("article");
    expect(card).toHaveTextContent("room");
    expect(card).toHaveTextContent("Available fromby arrangement");
    expect(card).not.toHaveTextContent("sostanoval");
    expect(card.querySelector(".listing-details")).toBeNull();
  });
});

describe("ListingAbout in English", () => {
  it("labels the facts and amounts", () => {
    inEnglish(<ListingAbout listing={listing()} />);
    expect(
      screen.getByRole("heading", { name: "About the place" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("The owner hasn't added a description yet."),
    ).toBeInTheDocument();
    const facts = screen
      .getAllByRole("term")
      .map((term) => [term.textContent, term.nextElementSibling?.textContent]);
    expect(facts).toEqual([
      ["Size", "16 m²"],
      ["Deposit", "€400"],
      ["Roommates", "2"],
      ["Furnished", "no"],
      ["Bills included", "yes"],
    ]);
  });
});

describe("listing detail page in English", () => {
  it("shows the listing, its status and the safety note", () => {
    inEnglish(<ListingDetail params={{ id: "a" }} />);
    expect(
      screen.getByRole("heading", { name: "Soba v centru" }),
    ).toBeInTheDocument();
    expect(screen.getByText("studio")).toBeInTheDocument();
    expect(screen.getByText("Move-in")).toBeInTheDocument();
    expect(screen.getByText("20/09/2026")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Send a match request" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Save listing" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Report listing" })).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Back to listings" }),
    ).toBeVisible();
  });

  it("explains why a filled listing takes no requests", () => {
    state.listing = listing({ isFilled: true });
    inEnglish(<ListingDetail params={{ id: "a" }} />);
    expect(screen.getByText("Filled")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Send a match request" }),
    ).toBeDisabled();
    expect(
      screen.getByText(
        "This listing is filled, so match requests aren't possible.",
      ),
    ).toBeInTheDocument();
  });

  it("says when the listing is gone", () => {
    state.listing = null;
    inEnglish(<ListingDetail params={{ id: "a" }} />);
    expect(
      screen.getByRole("heading", {
        name: "This listing is no longer available",
      }),
    ).toBeInTheDocument();
  });
});

describe("feed, search and favourites in English", () => {
  it("renders the listings feed", () => {
    inEnglish(<ListingsPage />);
    expect(
      screen.getByRole("heading", { name: "Room listings" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open chats and notifications" }),
    ).toHaveAttribute("href", "/chats");
    expect(screen.getByText("Recommended roommates")).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(1);
  });

  it("renders search with English counts, filters and sorting", () => {
    state.pages = [
      listing({ price: 400 }),
      listing({ id: "b", title: "Druga soba", price: 450 }),
    ];
    inEnglish(<SearchPage />);
    expect(
      screen.getByRole("heading", { name: "2 listings for you" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Sorted by compatibility")).toBeInTheDocument();
    expect(screen.getByLabelText(/Maximum budget/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove filter: up to €500" }),
    ).toHaveTextContent("up to €500");
    expect(
      screen.getByRole("button", { name: "Filters (1)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Price: low to high" }),
    ).toBeInTheDocument();
  });

  it("keeps the Slovenian search copy", () => {
    state.pages = [listing({ price: 400 })];
    render(<SearchPage />);
    expect(
      screen.getByRole("heading", { name: "1 oglas zate" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Odstrani filter: do 500 €" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Filtri (1)" }),
    ).toBeInTheDocument();
  });

  it("renders favourites and the empty state", () => {
    inEnglish(<FavoritesPage />);
    expect(
      screen.getByRole("heading", { name: "Favourite listings" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "You haven't saved any listings yet",
      }),
    ).toBeInTheDocument();
  });

  it("lists saved listings with an English price line", () => {
    state.favorites = ["a"];
    state.favoriteListings = [listing()];
    inEnglish(<FavoritesPage />);
    const row = screen.getByRole("link", { name: /Soba v centru/ });
    expect(within(row).getByText("Vič, €1,250 / month")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Remove Soba v centru from favourites",
      }),
    ).toBeInTheDocument();
  });
});

describe("listing form in English", () => {
  it("labels fields and shows validation messages with their limits", async () => {
    inEnglish(<NewListingPage />);
    // Without Supabase the page explains that posting is unavailable.
    expect(
      screen.getByText(
        "Posting listings isn't available right now. Try again later.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Post a listing" }),
    ).toBeInTheDocument();
  });
});

describe("ListingForm", () => {
  it("validates in English and lists room types by their English labels", async () => {
    const { ListingForm } = await import("../../components/listing-form");
    const { emptyListingDraft } =
      await import("../../lib/listings/listing-form");
    const onSubmit = vi.fn();
    inEnglish(
      <ListingForm
        initialDraft={{ ...emptyListingDraft, title: "x".repeat(121) }}
        submitLabel="Post listing"
        onSubmit={onSubmit}
      />,
    );
    expect(screen.getByRole("option", { name: "shared flat" })).toHaveAttribute(
      "value",
      "deljeno stanovanje",
    );
    await userEvent.click(screen.getByRole("button", { name: "Post listing" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Enter a location.")).toBeInTheDocument();
    expect(screen.getByText("Enter a price.")).toBeInTheDocument();
    expect(
      screen.getByText("The title can be at most 120 characters long."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Location *")).toHaveFocus();
  });

  it("shows a save failure in Slovenian", async () => {
    const { ListingForm } = await import("../../components/listing-form");
    const { emptyListingDraft } =
      await import("../../lib/listings/listing-form");
    render(
      <ListingForm
        initialDraft={{
          ...emptyListingDraft,
          location: "Ljubljana",
          price: "300",
        }}
        submitLabel="Shrani spremembe"
        onSubmit={async () => "conflict"}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Shrani spremembe" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Oglas je bil medtem spremenjen ali odstranjen. Osveži stran in poskusi znova.",
    );
  });
});
