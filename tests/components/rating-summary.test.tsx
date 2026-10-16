import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RatingSummaryView } from "../../components/rating-summary";

describe("RatingSummaryView", () => {
  it("shows nothing for people who haven't turned ratings on", () => {
    const { container } = render(
      <RatingSummaryView summary={{ state: "hidden" }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a neutral line below the threshold", () => {
    render(<RatingSummaryView summary={{ state: "insufficient" }} />);
    expect(screen.getByText("Še ni dovolj ocen")).toBeInTheDocument();
  });

  it("shows the ratio and the top strengths", () => {
    render(
      <RatingSummaryView
        summary={{
          state: "shown",
          total: 4,
          wouldLiveAgain: 3,
          strengths: [{ tag: "clean_tidy", count: 3 }],
        }}
      />,
    );
    expect(
      screen.getByText("3 od 4 sostanovalcev bi spet živeli s to osebo"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("list", { name: "Najpogostejše močne točke" }),
    ).toHaveTextContent("Čist(a) in urejen(a) · 3");
  });
});
