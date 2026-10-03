// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { Poi } from "@/types/Poi";
vi.mock("maplibre-gl", () => {
  class Map {
    container: HTMLDivElement;
    removed = false;

    constructor({ container }: { container: HTMLDivElement }) {
      this.container = container;
    }

    addControl() {}
    easeTo() {}
    getZoom() {
      return 15;
    }
    getContainer() {
      return this.container;
    }
    getStyle() {
      return { layers: [] };
    }
    on() {}
    once(event: string, handler: () => void) {
      if (event === "load") {
        handler();
      }
    }
    remove() {
      this.removed = true;
    }
  }

  class Marker {
    element = document.createElement("div");
    removed = false;

    constructor() {}

    setLngLat() {
      return this;
    }
    addTo(map: Map) {
      map.getContainer().append(this.element);
      return this;
    }
    getElement() {
      return this.element;
    }
    remove() {
      this.removed = true;
      this.element.remove();
    }
  }

  class Popup {
    container = document.createElement("div");
    content = document.createElement("div");
    element?: HTMLElement;
    isOpen = false;

    constructor() {
      this.content.className = "maplibregl-popup-content";
      this.container.append(this.content);
    }

    setDOMContent(element: HTMLElement) {
      this.element = element;
      this.content.append(element);
      return this;
    }
    setLngLat() {
      return this;
    }
    addTo(map: Map) {
      map.getContainer().append(this.container);
      this.isOpen = true;
      return this;
    }
    getElement() {
      return this.container;
    }
    remove() {
      this.container.remove();
      this.isOpen = false;
      return this;
    }
  }

  return {
    default: { Map, Marker, NavigationControl: class NavigationControl {}, Popup },
    Map,
    Marker,
    NavigationControl: class NavigationControl {},
    Popup,
  };
});

import { CityExplorer } from ".";

const pois: Poi[] = (
  [
    { id: "church", name: "A Church", categories: ["Church"] },
    { id: "museum", name: "A Museum", categories: ["Museum"] },
    { id: "both", name: "A Church Museum", categories: ["Church", "Museum"] },
    { id: "unknown", name: "An Unclassified Place", categories: [] },
  ] satisfies Array<Pick<Poi, "id" | "name" | "categories">>
).map((poi) => ({ city: "Rome", coordinates: { lat: 41, lng: 12 }, funFacts: [], ...poi }));
const server = setupServer(
  http.get("*/api/pois/rome/:id/dialog-content", () =>
    HttpResponse.json({
      storyContent: {
        introduction: "A real story response.",
        topics: { history: [], design: [], art: [] },
        relatedPeople: [],
      },
    }),
  ),
);
const nativeFetch = globalThis.fetch;
beforeAll(() => {
  vi.stubGlobal("fetch", (input: string | URL | Request, init?: RequestInit) =>
    nativeFetch(typeof input === "string" ? new URL(input, "http://localhost") : input, init),
  );
  server.listen({ onUnhandledRequest: "error" });
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => {
  server.close();
  vi.unstubAllGlobals();
});

describe("visitor category filtering", () => {
  it("matches any selected category, deduplicates matches and excludes uncategorized places until fully cleared", async () => {
    const user = userEvent.setup();
    render(<CityExplorer citySlug="rome" coordinates={[12, 41]} initialZoom={15} pois={pois} />);
    await user.click(
      screen.getByRole("button", { name: "Show subcategories for Churches & cathedrals" }),
    );
    expect(screen.getByRole("status")).toHaveTextContent("4 places");
    expect(
      screen.getByRole("button", { name: "Open details for An Unclassified Place" }),
    ).toBeInTheDocument();
    for (const checkbox of screen.getAllByRole("checkbox")) expect(checkbox).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Clear categories" }));
    await user.click(screen.getByRole("checkbox", { name: "Churches" }));
    expect(screen.getByRole("status")).toHaveTextContent("2 places");
    expect(
      screen.queryByRole("button", { name: "Open details for An Unclassified Place" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Open details for A Museum" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Museum" }));
    expect(screen.getByRole("status")).toHaveTextContent("3 places");
    expect(
      screen.getAllByRole("button", { name: "Open details for A Church Museum" }),
    ).toHaveLength(1);
    await user.click(screen.getByRole("checkbox", { name: "Churches" }));
    expect(screen.getByRole("status")).toHaveTextContent("2 places");
    expect(
      screen.queryByRole("button", { name: "Open details for A Church" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear categories" }));
    expect(screen.getByRole("status")).toHaveTextContent("4 places");
    expect(
      screen.getByRole("button", { name: "Open details for An Unclassified Place" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Museum" })).not.toBeChecked();
  });

  it("keeps matching details open, closes excluded details, and does not reopen them after clearing", async () => {
    const user = userEvent.setup();
    render(
      <CityExplorer
        citySlug="rome"
        coordinates={[12, 41]}
        initialZoom={15}
        pois={pois}
        initialSelectedPoiId="museum"
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "Show subcategories for Churches & cathedrals" }),
    );
    expect(screen.getByRole("heading", { name: "A Museum" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear categories" }));
    await user.click(screen.getByRole("checkbox", { name: "Museum" }));
    expect(screen.getByRole("heading", { name: "A Museum" })).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Churches" }));
    expect(screen.getByRole("heading", { name: "A Museum" })).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Museum" }));
    expect(screen.queryByRole("heading", { name: "A Museum" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear categories" }));
    expect(screen.queryByRole("heading", { name: "A Museum" })).not.toBeInTheDocument();
    await user.click(
      within(screen.getByRole("complementary", { name: "Discover places" })).getByRole("button", {
        name: "A Church",
      }),
    );
    expect(screen.getByRole("heading", { name: "A Church" })).toBeInTheDocument();
    expect(await screen.findByText("A real story response.")).toBeInTheDocument();
  });

  it("selects and clears every child with its parent, with disjoint child counts", async () => {
    const user = userEvent.setup();
    render(
      <CityExplorer
        citySlug="rome"
        coordinates={[12, 41]}
        initialZoom={15}
        pois={[
          ...pois,
          {
            id: "basilica",
            name: "A Basilica",
            city: "Rome",
            coordinates: { lat: 41, lng: 12 },
            funFacts: [],
            categories: ["Church", "Basilica"],
          },
          {
            id: "cathedral",
            name: "A Cathedral",
            city: "Rome",
            coordinates: { lat: 41, lng: 12 },
            funFacts: [],
            categories: ["Church", "Basilica", "Cathedral"],
          },
        ]}
        initialSelectedPoiId="basilica"
      />,
    );
    expect(screen.getByRole("checkbox", { name: "Churches & cathedrals" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Museum" })).toBeChecked();
    expect(screen.getByRole("status")).toHaveTextContent("6 places");
    await user.click(screen.getByRole("button", { name: "Clear categories" }));
    expect(screen.queryByRole("checkbox", { name: "Basilicas" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Churches & cathedrals" }));
    expect(screen.getByRole("status")).toHaveTextContent("4 places");
    expect(screen.queryByRole("checkbox", { name: "Basilicas" })).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Show subcategories for Churches & cathedrals" }),
    );
    expect(screen.getByRole("checkbox", { name: "Basilicas" })).toBeChecked();
    await user.click(screen.getByRole("checkbox", { name: "Churches & cathedrals" }));
    expect(screen.getByRole("checkbox", { name: "Basilicas" })).toHaveAccessibleDescription(
      "Subcategory of Churches & cathedrals",
    );
    expect(
      screen.getByRole("checkbox", { name: "Churches & cathedrals" }).parentElement,
    ).toHaveTextContent("4");
    expect(screen.getByRole("checkbox", { name: "Churches" }).parentElement).toHaveTextContent("2");
    expect(screen.getByRole("checkbox", { name: "Basilicas" }).parentElement).toHaveTextContent(
      "1",
    );
    expect(screen.getByRole("checkbox", { name: "Cathedrals" }).parentElement).toHaveTextContent(
      "1",
    );
    await user.click(screen.getByRole("checkbox", { name: "Churches & cathedrals" }));
    expect(screen.getByRole("checkbox", { name: "Cathedrals" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Churches" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Basilicas" })).toBeChecked();
    expect(screen.getByRole("status")).toHaveTextContent("4 places");
    expect(screen.getByRole("heading", { name: "A Basilica" })).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Churches & cathedrals" }));
    expect(screen.getByRole("checkbox", { name: "Cathedrals" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Churches" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Basilicas" })).not.toBeChecked();
    expect(screen.getByRole("status")).toHaveTextContent("6 places");
    await user.click(screen.getByRole("checkbox", { name: "Churches & cathedrals" }));
    await user.click(screen.getByRole("checkbox", { name: "Churches" }));
    expect(screen.getByRole("checkbox", { name: "Churches & cathedrals" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Basilicas" })).toBeChecked();
    expect(screen.getByRole("status")).toHaveTextContent("2 places");
    expect(
      screen.queryByRole("button", { name: "Open details for A Church" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "A Basilica" })).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Museum" }));
    expect(screen.getByRole("status")).toHaveTextContent("4 places");
    await user.click(screen.getByRole("checkbox", { name: "Basilicas" }));
    expect(screen.queryByRole("heading", { name: "A Basilica" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear categories" }));
    expect(screen.getByRole("status")).toHaveTextContent("6 places");
    expect(screen.queryByRole("heading", { name: "A Basilica" })).not.toBeInTheDocument();
  });

  it("hides empty categories and subcategories, and collapsing preserves selection", async () => {
    const user = userEvent.setup();
    render(<CityExplorer citySlug="rome" coordinates={[12, 41]} initialZoom={15} pois={pois} />);
    expect(screen.queryByRole("checkbox", { name: "Aqueduct" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Churches" })).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Show subcategories for Churches & cathedrals" }),
    );
    expect(screen.queryByRole("checkbox", { name: "Cathedrals" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Basilicas" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear categories" }));
    await user.click(screen.getByRole("checkbox", { name: "Churches" }));
    expect(screen.getByRole("status")).toHaveTextContent("2 places");
    expect(screen.getByRole("checkbox", { name: "Museum" })).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Hide subcategories for Churches & cathedrals" }),
    );
    expect(screen.queryByRole("checkbox", { name: "Churches" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("2 places");
    await user.click(
      screen.getByRole("button", { name: "Show subcategories for Churches & cathedrals" }),
    );
    expect(screen.getByRole("checkbox", { name: "Churches" })).toBeChecked();
  });
});
