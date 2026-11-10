import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  deleted: [] as { id: string }[] | null,
  updated: null as { id: string; is_filled: boolean } | null,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("../../components/providers", () => ({
  useFavorites: () => ({ isFavorite: () => false, toggleFavorite: vi.fn() }),
}));

vi.mock("../../lib/config", () => ({
  getSupabaseConfig: () => ({ configured: true }),
}));

vi.mock("../../lib/supabase/browser", () => {
  const chain = {
    delete: () => chain,
    update: () => chain,
    eq: () => chain,
    select: (columns: string) =>
      columns === "id"
        ? Promise.resolve({ data: db.deleted, error: null })
        : chain,
    maybeSingle: async () => ({ data: db.updated, error: null }),
  };
  return {
    createSupabaseBrowserClient: () => ({
      auth: { getUser: async () => ({ data: { user: { id: "owner-1" } } }) },
      from: () => chain,
    }),
  };
});

import { DeleteListingButton } from "../../components/delete-listing-button";
import { ListingStatusToggle } from "../../components/listing-status-control";
import { OwnerListingActions } from "../../components/owner-listing-actions";
import { catalogs } from "../../lib/i18n/messages";
import { I18nProvider } from "../../lib/i18n/provider";

function inEnglish(ui: React.ReactNode) {
  return render(
    <I18nProvider locale="en" messages={catalogs.en}>
      {ui}
    </I18nProvider>,
  );
}

beforeEach(() => {
  db.deleted = [];
  db.updated = null;
});

describe("owner listing controls in English", () => {
  it("offers the owner's links", async () => {
    inEnglish(<OwnerListingActions listingId="a" ownerId="owner-1" />);
    expect(
      await screen.findByRole("link", { name: "Edit listing" }),
    ).toHaveAttribute("href", "/listings/a/edit");
    expect(
      screen.getByRole("link", { name: "All my listings" }),
    ).toHaveAttribute("href", "/listings/mine");
  });

  it("confirms a deletion and explains a failed one", async () => {
    inEnglish(<DeleteListingButton listingId="a" ownerId="owner-1" />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Delete listing" }),
    );
    expect(
      screen.getByRole("alertdialog", { name: "Delete listing?" }),
    ).toHaveAccessibleDescription("The listing can't be restored.");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    // Nothing was deleted: the listing is gone or not the user's.
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't delete the listing. It no longer exists or isn't yours.",
    );
  });

  it("shows a failed status change in Slovenian by default", async () => {
    const onChange = vi.fn();
    render(
      <ListingStatusToggle
        listingId="a"
        isFilled={false}
        onChange={onChange}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Označi kot zapolnjeno" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Stanja oglasa ni bilo mogoče spremeniti. Oglas ne obstaja več ali nisi njegov lastnik.",
    );
    // Rolled back to the state before the press.
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it("shows a failed status change in English", async () => {
    inEnglish(
      <ListingStatusToggle listingId="a" isFilled onChange={vi.fn()} />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Mark as available" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't change the listing's status. It no longer exists or isn't yours.",
    );
  });
});
