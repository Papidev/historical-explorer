// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Poi } from "@/types/Poi";
import { PoiPreviewCard } from "./PoiPreviewCard";

const poi: Poi = {
  id: "forum-boarium",
  name: "Forum Boarium",
  city: "Rome",
  coordinates: { lat: 41.889, lng: 12.481 },
  shortDescription: "The ancient cattle market beside the Tiber.",
  mainImageUrl: "https://example.com/forum-boarium.jpg",
  funFacts: [],
};

afterEach(cleanup);

describe("PoiPreviewCard", () => {
  it("shows the POI name, description, and main image", () => {
    render(<PoiPreviewCard poi={poi} onOpenDetails={() => {}} />);

    expect(screen.getByRole("heading", { name: "Forum Boarium" })).toBeInTheDocument();
    expect(screen.getByText("The ancient cattle market beside the Tiber.")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Immagine principale di Forum Boarium" }),
    ).toHaveAttribute("src", poi.mainImageUrl);
  });

  it("shows the placeholder when the main image is unavailable or fails to load", () => {
    const { rerender } = render(
      <PoiPreviewCard poi={{ ...poi, mainImageUrl: undefined }} onOpenDetails={() => {}} />,
    );

    expect(screen.getByText("Immagine non disponibile")).toBeInTheDocument();

    rerender(<PoiPreviewCard key="with-image" poi={poi} onOpenDetails={() => {}} />);
    fireEvent.error(screen.getByRole("img"));

    expect(screen.getByText("Immagine non disponibile")).toBeInTheDocument();
  });

  it("omits the description when the POI does not provide one", () => {
    render(
      <PoiPreviewCard poi={{ ...poi, shortDescription: undefined }} onOpenDetails={() => {}} />,
    );

    expect(screen.queryByText(poi.shortDescription as string)).not.toBeInTheDocument();
  });

  it("opens the POI details when the card is clicked", () => {
    const onOpenDetails = vi.fn();
    render(<PoiPreviewCard poi={poi} onOpenDetails={onOpenDetails} />);

    fireEvent.click(screen.getByRole("button", { name: /Forum Boarium/ }));

    expect(onOpenDetails).toHaveBeenCalledOnce();
  });
});
