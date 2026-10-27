// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { Poi } from "@/types/Poi";
const cameraUpdates = vi.hoisted(
  () => [] as Array<{ center?: [number, number]; offset?: [number, number] }>,
);
vi.mock("maplibre-gl", () => {
  class Map {
    container: HTMLDivElement;
    removed = false;

    constructor({ container }: { container: HTMLDivElement }) {
      this.container = container;
    }

    addControl() {}
    easeTo(view: { center?: [number, number]; offset?: [number, number] }) {
      cameraUpdates.push(view);
    }
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
beforeEach(() => {
  window.history.replaceState(null, "", "/rome");
  cameraUpdates.length = 0;
});
beforeAll(() => {
  vi.stubGlobal("fetch", (input: string | URL | Request, init?: RequestInit) =>
    nativeFetch(typeof input === "string" ? new URL(input, "http://localhost") : input, init),
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  server.listen({ onUnhandledRequest: "error" });
});
afterEach(() => {
  cleanup();
  window.innerWidth = 1024;
  server.resetHandlers();
});
afterAll(() => {
  server.close();
  vi.unstubAllGlobals();
});

describe("visitor category filtering", () => {
  it("groups architectural, public, memorial, and remaining places", async () => {
    const user = userEvent.setup();
    render(
      <CityExplorer
        citySlug="rome"
        coordinates={[12, 41]}
        initialZoom={15}
        pois={[
          ...pois,
          ...["Castle", "Square", "Monument", "Archaeological Site"].map((category) => ({
            ...pois[0],
            id: category,
            name: `A ${category}`,
            categories: [category],
          })),
        ]}
      />,
    );

    for (const [parent, child] of [
      ["Architecture", "Castle"],
      ["Public Spaces", "Square"],
      ["Memorials", "Monument"],
      ["Other places", "Archaeological Site"],
    ]) {
      expect(screen.getByRole("checkbox", { name: parent })).toBeChecked();
      await user.click(screen.getByRole("button", { name: `Show subcategories for ${parent}` }));
      expect(screen.getByRole("checkbox", { name: child })).toBeChecked();
    }

    await user.click(screen.getByRole("checkbox", { name: "Other places" }));
    expect(screen.getByRole("checkbox", { name: "Archaeological Site" })).not.toBeChecked();
    expect(screen.getByRole("status")).toHaveTextContent("6 places");

    await user.click(screen.getByRole("checkbox", { name: "Archaeological Site" }));
    expect(screen.getByRole("checkbox", { name: "Other places" })).toBeChecked();
    expect(screen.getByRole("status")).toHaveTextContent("8 places");
  });

  it("opens subcategories from the category row while keeping checkbox selection separate", async () => {
    const user = userEvent.setup();
    render(<CityExplorer citySlug="rome" coordinates={[12, 41]} initialZoom={15} pois={pois} />);

    await user.click(screen.getByText("Religion", { exact: true }));
    expect(screen.getByRole("checkbox", { name: "Churches" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Religion" })).toBeChecked();
    expect(screen.getByRole("status")).toHaveTextContent("4 places");

    await user.click(
      within(screen.getByRole("button", { name: "Hide subcategories for Religion" })).getByText(
        "2",
      ),
    );
    expect(screen.queryByRole("checkbox", { name: "Churches" })).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Religion" })).toBeChecked();

    screen.getByRole("button", { name: "Show subcategories for Religion" }).focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("checkbox", { name: "Churches" })).toBeChecked();
    await user.click(screen.getByRole("checkbox", { name: "Religion" }));
    expect(screen.getByRole("checkbox", { name: "Churches" })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Hide subcategories for Religion" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("toggles the category accordion from its title and summary without changing selection", async () => {
    const user = userEvent.setup();
    render(<CityExplorer citySlug="rome" coordinates={[12, 41]} initialZoom={15} pois={pois} />);

    expect(screen.getByRole("button", { name: "Hide categories" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("checkbox", { name: "Religion" })).toBeVisible();
    expect(screen.queryByRole("checkbox", { name: "Churches" })).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "All categories" })).toBeChecked();

    await user.click(screen.getByText("All categories", { exact: true }));
    expect(screen.getByRole("button", { name: "Show categories" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByRole("checkbox", { name: "All categories" })).toBeChecked();

    await user.click(screen.getByText("All", { exact: true }));
    expect(screen.getByRole("button", { name: "Hide categories" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await user.click(screen.getByText("All categories", { exact: true }));
    screen.getByRole("button", { name: "Show categories" }).focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: "Hide categories" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await user.click(screen.getByRole("checkbox", { name: "All categories" }));
    expect(screen.getByRole("checkbox", { name: "All categories" })).not.toBeChecked();
    expect(screen.getByRole("status")).toHaveTextContent("0 places");
  });

  it("opens and closes filters by swipe, then matches selected categories until fully cleared", async () => {
    window.innerWidth = 390;
    const user = userEvent.setup();
    render(<CityExplorer citySlug="rome" coordinates={[12, 41]} initialZoom={15} pois={pois} />);
    const edge = screen.getByRole("button", { name: "Open filters" });
    expect(screen.queryByRole("button", { name: /^Categories/ })).not.toBeInTheDocument();
    fireEvent.touchStart(edge, { touches: [{ clientX: 5, clientY: 100 }] });
    fireEvent.touchEnd(edge, { changedTouches: [{ clientX: 25, clientY: 100 }] });
    expect(edge).toBeInTheDocument();
    fireEvent.touchStart(edge, { touches: [{ clientX: 5, clientY: 100 }] });
    fireEvent.touchEnd(edge, { changedTouches: [{ clientX: 80, clientY: 220 }] });
    expect(edge).toBeInTheDocument();
    fireEvent.touchStart(edge, { touches: [{ clientX: 5, clientY: 100 }] });
    fireEvent.touchMove(edge, {
      touches: [
        { clientX: 35, clientY: 100 },
        { clientX: 40, clientY: 120 },
      ],
    });
    fireEvent.touchEnd(edge, { changedTouches: [{ clientX: 100, clientY: 100 }] });
    expect(edge).toBeInTheDocument();
    fireEvent.touchStart(edge, { touches: [{ clientX: 5, clientY: 100 }] });
    fireEvent.touchEnd(edge, { changedTouches: [{ clientX: 100, clientY: 105 }] });
    expect(screen.queryByRole("button", { name: "Open filters" })).not.toBeInTheDocument();
    fireEvent.touchStart(await screen.findByRole("complementary", { name: "Discover places" }), {
      touches: [{ clientX: 200, clientY: 150 }],
    });
    fireEvent.touchEnd(screen.getByRole("complementary", { name: "Discover places" }), {
      changedTouches: [{ clientX: 100, clientY: 155 }],
    });
    expect(screen.getByRole("button", { name: "Open filters" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open filters" }));
    expect(screen.queryByRole("checkbox", { name: "Museums" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show subcategories for Arts & Culture" }));
    await user.click(screen.getByRole("button", { name: "Show subcategories for Religion" }));
    expect(screen.getByRole("status")).toHaveTextContent("4 places");
    expect(
      screen.getByRole("button", { name: "Open details for An Unclassified Place" }),
    ).toBeInTheDocument();
    for (const checkbox of screen.getAllByRole("checkbox")) expect(checkbox).toBeChecked();
    await user.click(screen.getByRole("checkbox", { name: "All categories" }));
    await user.click(screen.getByRole("checkbox", { name: "Churches" }));
    expect(screen.getByRole("checkbox", { name: "All categories" })).toBePartiallyChecked();
    expect(screen.getByRole("status")).toHaveTextContent("2 places");
    expect(
      screen.queryByRole("button", { name: "Open details for An Unclassified Place" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Open details for A Museum" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Museums" }));
    expect(screen.getByRole("status")).toHaveTextContent("4 places");
    expect(screen.getByRole("checkbox", { name: "All categories" })).toBeChecked();
    expect(
      screen.getAllByRole("button", { name: "Open details for A Church Museum" }),
    ).toHaveLength(1);
    await user.click(screen.getByRole("checkbox", { name: "Churches" }));
    expect(screen.getByRole("status")).toHaveTextContent("2 places");
    expect(
      screen.queryByRole("button", { name: "Open details for A Church" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "All categories" }));
    await user.click(screen.getByRole("checkbox", { name: "All categories" }));
    expect(screen.getByRole("status")).toHaveTextContent("0 places");
    expect(screen.queryByRole("button", { name: /Open details for/ })).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "All categories" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "All categories" })).not.toBePartiallyChecked();
    expect(screen.getByRole("checkbox", { name: "Museums" })).not.toBeChecked();
    await user.click(screen.getByRole("checkbox", { name: "Museums" }));
    expect(screen.getByRole("status")).toHaveTextContent("2 places");
    expect(screen.getByRole("button", { name: "Open details for A Museum" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "All categories" })).toBePartiallyChecked();
    await user.click(screen.getByRole("button", { name: "Hide categories" }));
    expect(screen.queryByRole("checkbox", { name: "Museums" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("2 places");
    expect(screen.getByRole("checkbox", { name: "All categories" })).toBePartiallyChecked();
    screen.getByRole("checkbox", { name: "All categories" }).focus();
    await user.keyboard(" ");
    for (const checkbox of screen.getAllByRole("checkbox")) expect(checkbox).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "All categories" })).not.toBePartiallyChecked();
    expect(screen.getByRole("status")).toHaveTextContent("4 places");
    expect(
      screen.getByRole("button", { name: "Open details for An Unclassified Place" }),
    ).toBeInTheDocument();
    await user.keyboard(" ");
    for (const checkbox of screen.getAllByRole("checkbox")) expect(checkbox).not.toBeChecked();
    expect(screen.getByRole("status")).toHaveTextContent("0 places");
    await user.keyboard(" ");
    expect(screen.getByRole("status")).toHaveTextContent("4 places");
    expect(screen.getByRole("button", { name: "Hide categories" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    for (const checkbox of screen.getAllByRole("checkbox")) expect(checkbox).toBeChecked();
    await user.click(screen.getByRole("checkbox", { name: "Churches" }));
    expect(screen.getByRole("checkbox", { name: "All categories" })).toBePartiallyChecked();
    await user.click(screen.getByRole("checkbox", { name: "Churches" }));
    expect(screen.getByRole("checkbox", { name: "Religion" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "All categories" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "All categories" })).not.toBePartiallyChecked();
    expect(screen.getByRole("status")).toHaveTextContent("4 places");
  });

  it("keeps matching details open, closes excluded details, and does not reopen them after clearing", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/rome?poiId=museum&source=shared#map");
    render(
      <CityExplorer
        citySlug="rome"
        coordinates={[12, 41]}
        initialZoom={15}
        pois={pois}
        initialSelectedPoiId="museum"
      />,
    );
    expect(screen.queryByRole("button", { name: "Open filters" })).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open details for A Museum", pressed: true }),
    ).toHaveClass("selected-poi-marker");
    await user.click(screen.getByRole("button", { name: "Close filters" }));
    expect(screen.getByRole("button", { name: "Open filters" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open filters" }));
    expect(screen.queryByRole("checkbox", { name: "Museums" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show subcategories for Arts & Culture" }));
    await user.click(screen.getByRole("button", { name: "Show subcategories for Religion" }));
    expect(screen.getByRole("heading", { name: "A Museum" })).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Religion" }));
    expect(screen.getByRole("checkbox", { name: "All categories" })).toBePartiallyChecked();
    expect(screen.getByRole("heading", { name: "A Museum" })).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Churches" }));
    expect(screen.getByRole("heading", { name: "A Museum" })).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Museums" }));
    expect(screen.queryByRole("heading", { name: "A Museum" })).not.toBeInTheDocument();
    expect(window.location.search).toBe("?source=shared");
    expect(window.location.hash).toBe("#map");
    await user.click(screen.getByRole("checkbox", { name: "All categories" }));
    await user.click(screen.getByRole("checkbox", { name: "All categories" }));
    expect(screen.queryByRole("heading", { name: "A Museum" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Churches" }));
    await user.click(
      within(screen.getByRole("complementary", { name: "Discover places" })).getByRole("button", {
        name: "A Church",
      }),
    );
    expect(screen.getByRole("heading", { name: "A Church" })).toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).get("poiId")).toBe("church");
    expect(
      screen.getByRole("button", { name: "Open details for A Church", pressed: true }),
    ).toHaveClass("selected-poi-marker");
    expect(await screen.findByText("A real story response.")).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Churches" }));
    expect(screen.getByRole("status")).toHaveTextContent("0 places");
    expect(screen.queryByRole("button", { name: /Open details for/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "A Church" })).not.toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).has("poiId")).toBe(false);
    window.history.back();
    expect(await screen.findByRole("heading", { name: "A Church" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("4 places");
    window.history.forward();
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "A Church" })).not.toBeInTheDocument(),
    );
    await user.click(screen.getByRole("checkbox", { name: "Churches" }));
    expect(screen.queryByRole("heading", { name: "A Church" })).not.toBeInTheDocument();
    await user.click(
      within(screen.getByRole("complementary", { name: "Discover places" })).getByRole("button", {
        name: "A Museum",
      }),
    );
    expect(screen.getByRole("heading", { name: "A Museum" })).toBeInTheDocument();
    const historyLength = window.history.length;
    await user.click(
      within(screen.getByRole("complementary", { name: "Discover places" })).getByRole("button", {
        name: "A Museum",
      }),
    );
    expect(window.history.length).toBe(historyLength);
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(
      screen.getByRole("button", { name: "Open details for A Museum", pressed: false }),
    ).not.toHaveClass("selected-poi-marker");
    expect(window.location.search).toBe("?source=shared");
    window.history.back();
    expect(await screen.findByRole("heading", { name: "A Museum" })).toBeInTheDocument();
    cleanup();
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
    window.history.replaceState(null, "", "/rome?poiId=missing");
    fireEvent.popState(window);
    expect(screen.queryByRole("heading", { name: "A Museum" })).not.toBeInTheDocument();
  });

  it("selects and clears every child with its parent, with disjoint child counts", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/rome?poiId=basilica");
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
    await user.click(screen.getByRole("button", { name: "Show subcategories for Arts & Culture" }));
    expect(screen.getByRole("checkbox", { name: "Religion" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Museums" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "All categories" })).toHaveAccessibleDescription(
      "All",
    );
    expect(screen.getByRole("status")).toHaveTextContent("6 places");
    await user.click(screen.getByRole("checkbox", { name: "All categories" }));
    expect(screen.queryByRole("checkbox", { name: "Basilicas" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Religion" }));
    expect(screen.getByRole("status")).toHaveTextContent("4 places");
    expect(screen.queryByRole("checkbox", { name: "Basilicas" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show subcategories for Religion" }));
    expect(screen.getByRole("checkbox", { name: "Basilicas" })).toBeChecked();
    ["Basilicas", "Cathedrals", "Churches"].forEach((name, index) =>
      expect(screen.getAllByRole("checkbox")[index + 4]).toHaveAccessibleName(name),
    );
    await user.click(screen.getByRole("checkbox", { name: "Religion" }));
    expect(screen.getByRole("checkbox", { name: "Basilicas" })).toHaveAccessibleDescription(
      "Subcategory of Religion",
    );
    expect(screen.getByRole("checkbox", { name: "Religion" }).parentElement).toHaveTextContent("4");
    expect(screen.getByRole("checkbox", { name: "Churches" }).parentElement).toHaveTextContent("2");
    expect(screen.getByRole("checkbox", { name: "Basilicas" }).parentElement).toHaveTextContent(
      "1",
    );
    expect(screen.getByRole("checkbox", { name: "Cathedrals" }).parentElement).toHaveTextContent(
      "1",
    );
    await user.click(screen.getByRole("checkbox", { name: "Religion" }));
    expect(screen.getByRole("checkbox", { name: "Cathedrals" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Religion" })).not.toBePartiallyChecked();
    expect(screen.getByRole("checkbox", { name: "Churches" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Basilicas" })).toBeChecked();
    expect(screen.getByRole("status")).toHaveTextContent("4 places");
    expect(screen.queryByRole("heading", { name: "A Basilica" })).not.toBeInTheDocument();
    await user.click(
      within(screen.getByRole("complementary", { name: "Discover places" })).getByRole("button", {
        name: "A Basilica",
      }),
    );
    expect(screen.getByRole("heading", { name: "A Basilica" })).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Religion" }));
    expect(screen.getByRole("checkbox", { name: "Cathedrals" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Religion" })).not.toBePartiallyChecked();
    expect(screen.getByRole("checkbox", { name: "Churches" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Basilicas" })).not.toBeChecked();
    expect(screen.getByRole("status")).toHaveTextContent("0 places");
    expect(screen.queryByRole("button", { name: /Open details for/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Religion" }));
    await user.click(screen.getByRole("checkbox", { name: "Churches" }));
    expect(screen.getByRole("checkbox", { name: "Religion" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Religion" })).toBePartiallyChecked();
    expect(screen.getByRole("checkbox", { name: "Basilicas" })).toBeChecked();
    expect(screen.getByRole("status")).toHaveTextContent("2 places");
    expect(
      screen.queryByRole("button", { name: "Open details for A Church" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "A Basilica" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Museums" }));
    expect(screen.getByRole("status")).toHaveTextContent("4 places");
    await user.click(screen.getByRole("checkbox", { name: "Basilicas" }));
    expect(screen.queryByRole("heading", { name: "A Basilica" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "All categories" }));
    await user.click(screen.getByRole("checkbox", { name: "All categories" }));
    expect(screen.getByRole("status")).toHaveTextContent("0 places");
    expect(screen.queryByRole("heading", { name: "A Basilica" })).not.toBeInTheDocument();
  });

  it("hides empty categories and subcategories, and collapsing preserves selection", async () => {
    const user = userEvent.setup();
    render(<CityExplorer citySlug="rome" coordinates={[12, 41]} initialZoom={15} pois={pois} />);
    await user.click(screen.getByRole("button", { name: "Show subcategories for Arts & Culture" }));
    expect(screen.queryByRole("checkbox", { name: "Aqueduct" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Churches" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show subcategories for Religion" }));
    expect(screen.queryByRole("checkbox", { name: "Cathedrals" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Basilicas" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "All categories" }));
    await user.click(screen.getByRole("checkbox", { name: "Churches" }));
    expect(screen.getByRole("status")).toHaveTextContent("2 places");
    expect(screen.getByRole("checkbox", { name: "Museums" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Hide subcategories for Religion" }));
    expect(screen.queryByRole("checkbox", { name: "Churches" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("2 places");
    await user.click(screen.getByRole("button", { name: "Show subcategories for Religion" }));
    expect(screen.getByRole("checkbox", { name: "Churches" })).toBeChecked();
  });
});

it("changes the visitor category-filter results after a Curator saves a shared type rule", async () => {
  const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { default: path } = await import("node:path");
  const { useState } = await import("react");
  const { createPoiTypeMappings } = await import("@/server/poiTypeMappings");
  const { createPoiCategoriesForCity } = await import("@/server/poiCategories");
  const { TypeMappings } = await import("@/app/admin/components/TypeMappings");
  const directory = mkdtempSync(path.join(tmpdir(), "mapping-visitor-flow-"));
  try {
    writeFileSync(
      path.join(directory, "poi-type-category-map.json"),
      JSON.stringify({ version: 1, mappings: { Q16970: ["Church"], Q33506: ["Museum"] } }),
    );
    mkdirSync(path.join(directory, "rome", "pois"), { recursive: true });
    mkdirSync(path.join(directory, "rome", "generated", "wikidata"), { recursive: true });
    writeFileSync(
      path.join(directory, "rome", "pois", "pois.geojson"),
      JSON.stringify({
        features: [
          { id: "church", wikidataId: "Q1", properties: { name: "A Church" } },
          { id: "museum", wikidataId: "Q2", properties: { name: "A Museum" } },
        ],
      }),
    );
    for (const [id, type, label] of [
      ["church", "Q16970", "church building"],
      ["museum", "Q33506", "museum"],
    ])
      writeFileSync(
        path.join(directory, "rome", "generated", "wikidata", `${id}.json`),
        JSON.stringify({ types: [{ id: type, label }] }),
      );
    const repository = createPoiTypeMappings(directory);
    const categories = createPoiCategoriesForCity("rome", directory);
    categories.rebuild();
    const user = userEvent.setup();
    const visitor = render(
      <CityExplorer
        citySlug="rome"
        coordinates={[12, 41]}
        initialZoom={15}
        pois={pois.slice(0, 2).map((poi) => ({ ...poi, categories: categories.getAll()[poi.id] }))}
      />,
    );
    await user.click(screen.getByRole("checkbox", { name: "Religion" }));
    expect(screen.getByRole("status")).toHaveTextContent("1 place");
    expect(
      screen.queryByRole("button", { name: "Open details for A Church" }),
    ).not.toBeInTheDocument();
    visitor.unmount();
    const EditingCatalog = () => {
      const [catalog, setCatalog] = useState(repository.getCatalog());
      return (
        <TypeMappings
          catalog={catalog}
          saveRule={async (id, next) => {
            const result = repository.save(id, next);
            setCatalog(repository.getCatalog());
            return result;
          }}
        />
      );
    };
    const curator = render(<EditingCatalog />);
    await user.click(screen.getByRole("checkbox", { name: "Museum" }));
    await user.click(screen.getByRole("button", { name: "Save categories" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Rule saved");
    curator.unmount();
    render(
      <CityExplorer
        citySlug="rome"
        coordinates={[12, 41]}
        initialZoom={15}
        pois={pois.slice(0, 2).map((poi) => ({ ...poi, categories: categories.getAll()[poi.id] }))}
      />,
    );
    await user.click(screen.getByRole("checkbox", { name: "Religion" }));
    expect(screen.getByRole("status")).toHaveTextContent("2 places");
    expect(screen.getByRole("button", { name: "Open details for A Church" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open details for A Museum" })).toBeInTheDocument();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

it("shows newly created categories and preserves filter membership when a category is renamed", async () => {
  const { DEFAULT_POI_CATEGORY_DEFINITIONS } = await import("@/types/PoiCategory");
  const user = userEvent.setup();
  const catalog = [
    ...pois,
    { ...pois[0], id: "lookout", name: "A Lookout", categories: ["Lookout"] },
  ];
  const definitions = [
    ...DEFAULT_POI_CATEGORY_DEFINITIONS,
    { id: "Lookout", name: "Lookout", label: "A lookout" },
  ];
  const view = render(
    <CityExplorer
      citySlug="rome"
      coordinates={[12, 41]}
      initialZoom={15}
      pois={catalog}
      categoryDefinitions={definitions}
    />,
  );
  expect(screen.getByRole("checkbox", { name: "A lookout" })).toBeVisible();
  ["All categories", "A lookout", "Arts & Culture", "Religion"].forEach((name, index) =>
    expect(screen.getAllByRole("checkbox")[index]).toHaveAccessibleName(name),
  );
  expect(screen.getByRole("checkbox", { name: "A lookout" })).toBeChecked();
  await user.click(screen.getByRole("checkbox", { name: "All categories" }));
  await user.click(screen.getByRole("checkbox", { name: "A lookout" }));
  expect(screen.getByRole("status")).toHaveTextContent("1 place");
  expect(screen.getByRole("button", { name: "Open details for A Lookout" })).toBeInTheDocument();
  view.rerender(
    <CityExplorer
      citySlug="rome"
      coordinates={[12, 41]}
      initialZoom={15}
      pois={catalog}
      categoryDefinitions={[
        ...DEFAULT_POI_CATEGORY_DEFINITIONS,
        { id: "Lookout", name: "Observation lookout" },
      ]}
    />,
  );
  expect(screen.getByRole("checkbox", { name: "Observation lookout" })).toBeChecked();
  expect(screen.queryByRole("checkbox", { name: "Lookout" })).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("1 place");
});

// The unused child must not prevent the parent from becoming fully selected.
const treeDefinitions = [
  { id: "Culture", name: "Cultural places" },
  { id: "Museum", name: "Museum", label: "Museums", parent: "Culture" },
  { id: "Church", name: "Church", parent: "Culture" },
  { id: "Abbey", name: "Abbey", parent: "Culture" },
  { id: "Monument", name: "Monument" },
];
const treePois: Poi[] = [
  ...pois,
  { ...pois[0], id: "culture", name: "A Cultural Place", categories: ["Culture"] },
  { ...pois[0], id: "monument", name: "A Monument", categories: ["Monument"] },
];

describe("category filter tree", () => {
  it("shows the selected leaf count while collapsed without counting parents or unavailable children", async () => {
    const user = userEvent.setup();
    render(
      <CityExplorer
        citySlug="rome"
        coordinates={[12, 41]}
        initialZoom={15}
        pois={treePois}
        categoryDefinitions={treeDefinitions}
      />,
    );
    expect(screen.getByText("All", { exact: true })).toBeVisible();
    await user.click(screen.getByRole("checkbox", { name: "All categories" }));
    expect(screen.getByText("None", { exact: true })).toBeVisible();
    await user.click(screen.getByRole("checkbox", { name: "Cultural places" }));
    expect(screen.getByText("2 selected", { exact: true })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Hide categories" }));
    expect(screen.queryByRole("checkbox", { name: "Cultural places" })).not.toBeInTheDocument();
    expect(screen.getByText("2 selected", { exact: true })).toBeVisible();
    expect(screen.getByRole("checkbox", { name: "All categories" })).toHaveAccessibleDescription(
      "2 selected",
    );
    await user.click(screen.getByRole("checkbox", { name: "All categories" }));
    expect(screen.getByText("All", { exact: true })).toBeVisible();
    expect(screen.getByRole("button", { name: "Show categories" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("opens collapsed categories when clearing All by keyboard but keeps them closed when selecting All", async () => {
    const user = userEvent.setup();
    render(
      <CityExplorer
        citySlug="rome"
        coordinates={[12, 41]}
        initialZoom={15}
        pois={treePois}
        categoryDefinitions={treeDefinitions}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Hide categories" }));
    screen.getByRole("checkbox", { name: "All categories" }).focus();
    await user.keyboard(" ");
    expect(screen.getByRole("checkbox", { name: "All categories" })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Hide categories" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("checkbox", { name: "Cultural places" })).toBeVisible();
    expect(screen.getByRole("checkbox", { name: "Monument" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("0 places");
    await user.click(screen.getByRole("button", { name: "Hide categories" }));
    screen.getByRole("checkbox", { name: "All categories" }).focus();
    await user.keyboard(" ");
    expect(screen.getByRole("checkbox", { name: "All categories" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Show categories" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByRole("checkbox", { name: "Cultural places" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("6 places");
  });

  it("restores checked parent and All states after reselecting the missing child", async () => {
    const user = userEvent.setup();
    render(
      <CityExplorer
        citySlug="rome"
        coordinates={[12, 41]}
        initialZoom={15}
        pois={treePois}
        categoryDefinitions={treeDefinitions}
      />,
    );
    expect(screen.getByRole("checkbox", { name: "All categories" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Cultural places" })).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Show subcategories for Cultural places" }),
    );
    expect(screen.queryByRole("checkbox", { name: "Abbey" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Museums" }));
    expect(screen.getByRole("checkbox", { name: "All categories" })).toHaveAccessibleDescription(
      "2 selected",
    );
    expect(screen.getByRole("checkbox", { name: "Cultural places" })).toBePartiallyChecked();
    expect(screen.getByRole("checkbox", { name: "All categories" })).toBePartiallyChecked();
    expect(
      screen.queryByRole("button", { name: "Open details for A Cultural Place" }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Hide subcategories for Cultural places" }),
    );
    expect(screen.getByRole("checkbox", { name: "Cultural places" })).toBePartiallyChecked();
    await user.click(screen.getByRole("button", { name: "Hide categories" }));
    expect(screen.getByRole("checkbox", { name: "All categories" })).toBePartiallyChecked();
    await user.click(screen.getByRole("button", { name: "Show categories" }));
    expect(screen.queryByRole("checkbox", { name: "Museums" })).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Show subcategories for Cultural places" }),
    );
    await user.click(screen.getByRole("checkbox", { name: "Museums" }));
    for (const checkbox of screen.getAllByRole("checkbox")) {
      expect(checkbox).toBeChecked();
      expect(checkbox).not.toBePartiallyChecked();
    }
    expect(screen.getByRole("checkbox", { name: "All categories" })).toHaveAccessibleDescription(
      "All",
    );
    expect(screen.getByRole("status")).toHaveTextContent("6 places");
    expect(
      screen.getByRole("button", { name: "Open details for An Unclassified Place" }),
    ).toBeInTheDocument();
  });

  it("selects all children from a mixed parent and clears them from a checked parent", async () => {
    const user = userEvent.setup();
    render(
      <CityExplorer
        citySlug="rome"
        coordinates={[12, 41]}
        initialZoom={15}
        pois={treePois}
        categoryDefinitions={treeDefinitions}
      />,
    );
    expect(screen.getByRole("checkbox", { name: "All categories" })).toHaveAccessibleDescription(
      "All",
    );
    await user.click(screen.getByRole("checkbox", { name: "All categories" }));
    expect(screen.getByRole("button", { name: "Hide categories" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("checkbox", { name: "All categories" })).toHaveAccessibleDescription(
      "None",
    );
    await user.click(
      screen.getByRole("button", { name: "Show subcategories for Cultural places" }),
    );
    await user.click(screen.getByRole("checkbox", { name: "Church" }));
    expect(screen.getByRole("checkbox", { name: "Cultural places" })).toBePartiallyChecked();
    expect(screen.getByRole("status")).toHaveTextContent("2 places");
    expect(screen.getByRole("checkbox", { name: "All categories" })).toHaveAccessibleDescription(
      "1 selected",
    );
    await user.click(screen.getByRole("checkbox", { name: "Cultural places" }));
    expect(screen.getByRole("checkbox", { name: "Cultural places" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Cultural places" })).not.toBePartiallyChecked();
    expect(screen.getByRole("checkbox", { name: "Church" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Museums" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "All categories" })).toHaveAccessibleDescription(
      "2 selected",
    );
    expect(screen.getByRole("checkbox", { name: "Monument" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "All categories" })).toBePartiallyChecked();
    expect(screen.getByRole("status")).toHaveTextContent("4 places");
    expect(
      screen.getByRole("button", { name: "Open details for A Cultural Place" }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("complementary", { name: "Discover places" })).getAllByRole(
        "listitem",
      ),
    ).toHaveLength(4);
    await user.click(screen.getByRole("checkbox", { name: "Cultural places" }));
    for (const checkbox of screen.getAllByRole("checkbox")) {
      expect(checkbox).not.toBeChecked();
      expect(checkbox).not.toBePartiallyChecked();
    }
    expect(screen.getByRole("status")).toHaveTextContent("0 places");
    expect(screen.queryByRole("button", { name: /Open details for/ })).not.toBeInTheDocument();
  });

  it("completes a parent from individual children without selecting another group", async () => {
    const user = userEvent.setup();
    render(
      <CityExplorer
        citySlug="rome"
        coordinates={[12, 41]}
        initialZoom={15}
        pois={treePois}
        categoryDefinitions={treeDefinitions}
      />,
    );
    expect(screen.getByRole("checkbox", { name: "All categories" })).toHaveAccessibleDescription(
      "All",
    );
    await user.click(screen.getByRole("checkbox", { name: "All categories" }));
    expect(screen.getByRole("button", { name: "Hide categories" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("checkbox", { name: "All categories" })).toHaveAccessibleDescription(
      "None",
    );
    await user.click(
      screen.getByRole("button", { name: "Show subcategories for Cultural places" }),
    );
    await user.click(screen.getByRole("checkbox", { name: "Church" }));
    await user.click(screen.getByRole("checkbox", { name: "Museums" }));
    expect(screen.getByRole("checkbox", { name: "Cultural places" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Cultural places" })).not.toBePartiallyChecked();
    expect(screen.getByRole("checkbox", { name: "All categories" })).toBePartiallyChecked();
    expect(screen.getByRole("checkbox", { name: "All categories" })).toHaveAccessibleDescription(
      "2 selected",
    );
    expect(screen.getByRole("checkbox", { name: "Monument" })).not.toBeChecked();
    expect(screen.getByRole("status")).toHaveTextContent("4 places");
    await user.click(screen.getByRole("checkbox", { name: "Monument" }));
    expect(screen.getByRole("checkbox", { name: "All categories" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "All categories" })).not.toBePartiallyChecked();
    expect(screen.getByRole("checkbox", { name: "All categories" })).toHaveAccessibleDescription(
      "All",
    );
    expect(screen.getByRole("status")).toHaveTextContent("6 places");
  });
});

describe("visitor place search", () => {
  it("matches names regardless of case or accents, updates suggestions and supports keyboard selection", async () => {
    const user = userEvent.setup();
    render(
      <CityExplorer
        citySlug="rome"
        coordinates={[12, 41]}
        initialZoom={15}
        pois={[
          ...pois,
          {
            ...pois[0],
            id: "cafe",
            name: "Café Museum",
            address: "Via Ostiense",
            coordinates: { lng: 12.5, lat: 41.8 },
          },
          { ...pois[0], id: "cafe-two", name: "Café Museum", address: "Trastevere" },
        ]}
      />,
    );
    const search = screen.getByRole("combobox", { name: "Search" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    await user.type(search, "CAFE");
    expect(await screen.findByRole("option", { name: /Café Museum.*Via Ostiense/ })).toBeVisible();
    expect(screen.getByRole("option", { name: /Café Museum.*Trastevere/ })).toBeVisible();
    expect(screen.getAllByRole("option")).toHaveLength(2);
    await user.keyboard("{ArrowDown}{ArrowUp}{Enter}");
    expect(await screen.findByRole("heading", { name: "Café Museum" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Open details for Café Museum", pressed: true }),
    ).toHaveClass("selected-poi-marker");
    expect(cameraUpdates.at(-1)).toEqual({ center: [12.5, 41.8], offset: [-48, 0] });
    expect(new URLSearchParams(window.location.search).get("poiId")).toBe("cafe");
    expect(search).toHaveValue("");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    // Searching for the same place again must focus it even if its coordinates have not changed.
    const historyLength = window.history.length;
    cameraUpdates.length = 0;
    await user.type(search, "cafe");
    await user.click(await screen.findByRole("option", { name: /Café Museum.*Via Ostiense/ }));
    expect(cameraUpdates).toEqual([{ center: [12.5, 41.8], offset: [-48, 0] }]);
    expect(window.history.length).toBe(historyLength);
  });

  it("shows no matches without searching outside the supplied public catalog and dismisses with Escape", async () => {
    const user = userEvent.setup();
    render(<CityExplorer citySlug="rome" coordinates={[12, 41]} initialZoom={15} pois={pois} />);
    const search = screen.getByRole("combobox", { name: "Search" });
    await user.type(search, "unpublished place");
    expect(await screen.findByText("No places match your search.")).toBeVisible();
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    await user.clear(search);
    await user.type(search, "museum");
    expect(await screen.findAllByRole("option")).toHaveLength(2);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(search).toHaveValue("");
    expect(new URLSearchParams(window.location.search).has("poiId")).toBe(false);
  });

  it("opens an excluded search result without changing filters or their count, then removes its marker on close", async () => {
    const user = userEvent.setup();
    render(<CityExplorer citySlug="rome" coordinates={[12, 41]} initialZoom={15} pois={pois} />);
    await user.click(screen.getByRole("checkbox", { name: "All categories" }));
    await user.click(screen.getByRole("button", { name: "Show subcategories for Arts & Culture" }));
    await user.click(screen.getByRole("checkbox", { name: "Museums" }));
    const search = screen.getByRole("combobox", { name: "Search" });
    await user.type(search, "A Church");
    await user.click(await screen.findByRole("option", { name: /A Church\s*Rome/ }));
    expect(await screen.findByRole("heading", { name: "A Church" })).toBeVisible();
    expect(screen.getByText("This place is excluded by your active filters.")).toBeVisible();
    expect(screen.getByRole("checkbox", { name: "Museums" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Religion" })).not.toBeChecked();
    expect(screen.getByRole("status")).toHaveTextContent("2 places");
    expect(
      screen.getByRole("button", { name: "Open details for A Church", pressed: true }),
    ).toBeVisible();
    expect(await screen.findByText("A real story response.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(
      screen.queryByRole("button", { name: "Open details for A Church" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Museums" })).toBeChecked();
    expect(screen.getByRole("status")).toHaveTextContent("2 places");
  });

  it("replaces the previous search exception and keeps ordinary marker selections subject to filters", async () => {
    const user = userEvent.setup();
    render(<CityExplorer citySlug="rome" coordinates={[12, 41]} initialZoom={15} pois={pois} />);
    await user.click(screen.getByRole("checkbox", { name: "All categories" }));
    await user.click(screen.getByRole("button", { name: "Show subcategories for Arts & Culture" }));
    const search = screen.getByRole("combobox", { name: "Search" });
    await user.type(search, "A Church");
    await user.click(await screen.findByRole("option", { name: /A Church\s*Rome/ }));
    await user.type(search, "A Museum");
    await user.click(await screen.findByRole("option", { name: /A Museum\s*Rome/ }));
    expect(
      screen.queryByRole("button", { name: "Open details for A Church" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open details for A Museum", pressed: true }),
    ).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("0 places");
    expect(screen.getByRole("checkbox", { name: "All categories" })).not.toBeChecked();
    await user.click(screen.getByRole("checkbox", { name: "Religion" }));
    expect(screen.getByText("This place is excluded by your active filters.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Open details for A Church" }));
    expect(await screen.findByRole("heading", { name: "A Church" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Open details for A Museum" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("This place is excluded by your active filters."),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Museums" })).not.toBeChecked();
  });

  it("closes mobile discovery after selecting a suggestion and leaves the map centered on return", async () => {
    window.innerWidth = 390;
    const user = userEvent.setup();
    render(<CityExplorer citySlug="rome" coordinates={[12, 41]} initialZoom={15} pois={pois} />);
    await user.click(screen.getByRole("button", { name: "Open filters" }));
    await user.type(screen.getByRole("combobox", { name: "Search" }), "museum");
    await user.click(await screen.findByRole("option", { name: /A Museum\s*Rome/ }));
    expect(await screen.findByRole("heading", { name: "A Museum" })).toBeVisible();
    expect(screen.queryByRole("combobox", { name: "Search" })).not.toBeInTheDocument();
    expect(cameraUpdates.at(-1)).toEqual({ center: [12, 41], offset: [0, 0] });
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByRole("button", { name: "Open filters" })).toBeVisible();
  });
});
