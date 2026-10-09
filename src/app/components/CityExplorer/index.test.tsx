// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
  window.innerWidth = 1024;
  server.resetHandlers();
});
afterAll(() => {
  server.close();
  vi.unstubAllGlobals();
});

describe("visitor category filtering", () => {
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
    expect(screen.getByRole("status")).toHaveTextContent("0 places");
    expect(screen.queryByRole("button", { name: /Open details for/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear categories" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Museum" })).not.toBeChecked();
    await user.click(screen.getByRole("checkbox", { name: "Museum" }));
    expect(screen.getByRole("status")).toHaveTextContent("2 places");
    expect(screen.getByRole("button", { name: "Open details for A Museum" })).toBeInTheDocument();
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
    expect(screen.queryByRole("button", { name: "Open filters" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close filters" }));
    expect(screen.getByRole("button", { name: "Open filters" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open filters" }));
    await user.click(
      screen.getByRole("button", { name: "Show subcategories for Churches & cathedrals" }),
    );
    expect(screen.getByRole("heading", { name: "A Museum" })).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Churches & cathedrals" }));
    expect(screen.getByRole("heading", { name: "A Museum" })).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Churches" }));
    expect(screen.getByRole("heading", { name: "A Museum" })).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Museum" }));
    expect(screen.queryByRole("heading", { name: "A Museum" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear categories" }));
    expect(screen.queryByRole("heading", { name: "A Museum" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Churches" }));
    await user.click(
      within(screen.getByRole("complementary", { name: "Discover places" })).getByRole("button", {
        name: "A Church",
      }),
    );
    expect(screen.getByRole("heading", { name: "A Church" })).toBeInTheDocument();
    expect(await screen.findByText("A real story response.")).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Churches" }));
    expect(screen.getByRole("status")).toHaveTextContent("0 places");
    expect(screen.queryByRole("button", { name: /Open details for/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "A Church" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Churches" }));
    expect(screen.queryByRole("heading", { name: "A Church" })).not.toBeInTheDocument();
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
    expect(screen.queryByRole("heading", { name: "A Basilica" })).not.toBeInTheDocument();
    await user.click(
      within(screen.getByRole("complementary", { name: "Discover places" })).getByRole("button", {
        name: "A Basilica",
      }),
    );
    expect(screen.getByRole("heading", { name: "A Basilica" })).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Churches & cathedrals" }));
    expect(screen.getByRole("checkbox", { name: "Cathedrals" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Churches" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Basilicas" })).not.toBeChecked();
    expect(screen.getByRole("status")).toHaveTextContent("0 places");
    expect(screen.queryByRole("button", { name: /Open details for/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Churches & cathedrals" }));
    await user.click(screen.getByRole("checkbox", { name: "Churches" }));
    expect(screen.getByRole("checkbox", { name: "Churches & cathedrals" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Basilicas" })).toBeChecked();
    expect(screen.getByRole("status")).toHaveTextContent("2 places");
    expect(
      screen.queryByRole("button", { name: "Open details for A Church" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "A Basilica" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Museum" }));
    expect(screen.getByRole("status")).toHaveTextContent("4 places");
    await user.click(screen.getByRole("checkbox", { name: "Basilicas" }));
    expect(screen.queryByRole("heading", { name: "A Basilica" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear categories" }));
    expect(screen.getByRole("status")).toHaveTextContent("0 places");
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
    await user.click(screen.getByRole("checkbox", { name: "Churches & cathedrals" }));
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
    await user.click(screen.getByRole("checkbox", { name: "Churches & cathedrals" }));
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
  const catalog = [...pois, { ...pois[0], id: "tower", name: "A Tower", categories: ["Tower"] }];
  const definitions = [...DEFAULT_POI_CATEGORY_DEFINITIONS, { id: "Tower", name: "Tower" }];
  const view = render(
    <CityExplorer
      citySlug="rome"
      coordinates={[12, 41]}
      initialZoom={15}
      pois={catalog}
      categoryDefinitions={definitions}
    />,
  );
  expect(screen.getByRole("checkbox", { name: "Tower" })).toBeChecked();
  await user.click(screen.getByRole("button", { name: "Clear categories" }));
  await user.click(screen.getByRole("checkbox", { name: "Tower" }));
  expect(screen.getByRole("status")).toHaveTextContent("1 place");
  expect(screen.getByRole("button", { name: "Open details for A Tower" })).toBeInTheDocument();
  view.rerender(
    <CityExplorer
      citySlug="rome"
      coordinates={[12, 41]}
      initialZoom={15}
      pois={catalog}
      categoryDefinitions={[
        ...DEFAULT_POI_CATEGORY_DEFINITIONS,
        { id: "Tower", name: "Observation tower" },
      ]}
    />,
  );
  expect(screen.getByRole("checkbox", { name: "Observation tower" })).toBeChecked();
  expect(screen.queryByRole("checkbox", { name: "Tower" })).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("1 place");
});
