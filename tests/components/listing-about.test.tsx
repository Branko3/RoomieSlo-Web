import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ListingAbout } from "../../components/listing-about";
import type { Listing } from "../../lib/supabase/mappers";

const base: Listing = {
  id: "listing-1",
  ownerId: "owner-1",
  title: "Soba v centru",
  district: "Center",
  location: "Ljubljana - Center",
  price: 320,
  available: "po dogovoru",
  availableFrom: null,
  roomType: "soba",
  details: "",
  image: "",
  isFilled: false,
  createdAt: "2026-01-01T00:00:00Z",
};

function facts() {
  return screen
    .queryAllByRole("term")
    .map((term) => [term.textContent, term.nextElementSibling?.textContent]);
}

describe("ListingAbout", () => {
  it("shows the owner's description and only the facts they entered", () => {
    render(
      <ListingAbout
        listing={{
          ...base,
          description: "Svetla soba z balkonom.",
          sizeSqm: 16,
          deposit: null,
          flatmates: 2,
          furnished: true,
          billsIncluded: false,
        }}
      />,
    );
    expect(screen.getByText("Svetla soba z balkonom.")).toBeInTheDocument();
    expect(facts()).toEqual([
      ["Velikost", "16 m²"],
      ["Sostanovalci", "2"],
      ["Opremljeno", "da"],
      ["Stroški vključeni", "ne"],
    ]);
  });

  it("says so when there is no description, and invents no facts", () => {
    render(<ListingAbout listing={{ ...base, description: "   " }} />);
    expect(screen.getByText("Lastnik še ni dodal opisa.")).toBeInTheDocument();
    expect(screen.queryByRole("definition")).not.toBeInTheDocument();
    expect(screen.queryByText(/Preverjen/)).not.toBeInTheDocument();
  });

  it("writes the deposit as a Slovenian amount", () => {
    render(<ListingAbout listing={{ ...base, deposit: 320.5 }} />);
    expect(facts()).toEqual([["Varščina", "320,50 €"]]);
  });
});
