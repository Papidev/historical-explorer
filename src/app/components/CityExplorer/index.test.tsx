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
    expect(screen.getByRole("status")).toHaveTextContent("4 places");
    expect(
      screen.getByRole("button", { name: "Open details for An Unclassified Place" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Church" }));
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
    await user.click(screen.getByRole("checkbox", { name: "Church" }));
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
    expect(screen.getByRole("heading", { name: "A Museum" })).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Museum" }));
    expect(screen.getByRole("heading", { name: "A Museum" })).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Church" }));
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

  it("shows an empty result and recovers when a zero-count category is cleared", async () => {
    const user = userEvent.setup();
    render(<CityExplorer citySlug="rome" coordinates={[12, 41]} initialZoom={15} pois={pois} />);
    await user.click(screen.getByRole("checkbox", { name: "Aqueduct" }));
    expect(screen.getByRole("status")).toHaveTextContent("0 places");
    expect(screen.getByText(/No places match these categories/)).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Aqueduct" }));
    expect(screen.getByRole("status")).toHaveTextContent("4 places");
  });
});
