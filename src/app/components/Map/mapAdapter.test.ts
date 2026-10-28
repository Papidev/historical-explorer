// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { createElement, StrictMode } from "react";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Poi } from "@/types/Poi";

const mapLibreFakes = vi.hoisted(() => ({
  maps: [] as Array<{ container: HTMLDivElement; removed: boolean }>,
  markers: [] as Array<{ element: HTMLDivElement; removed: boolean; color?: string }>,
  popups: [] as Array<{
    element?: HTMLElement;
    isOpen: boolean;
    positions: string[];
    additions: number;
  }>,
}));

vi.mock("maplibre-gl", () => {
  class Map {
    container: HTMLDivElement;
    removed = false;

    constructor({ container }: { container: HTMLDivElement }) {
      this.container = container;
      mapLibreFakes.maps.push(this);
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

    color?: string;

    constructor(options?: { color?: string }) {
      this.color = options?.color;
      mapLibreFakes.markers.push(this);
    }

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
    positions: string[] = [];
    additions = 0;

    constructor() {
      this.content.className = "maplibregl-popup-content";
      this.container.append(this.content);
      mapLibreFakes.popups.push(this);
    }

    setDOMContent(element: HTMLElement) {
      this.element = element;
      this.content.append(element);
      return this;
    }
    setLngLat() {
      this.positions.push(this.element?.textContent ?? "");
      return this;
    }
    addTo(map: Map) {
      this.additions += 1;
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

import { createMapLibreAdapter } from "./mapAdapter";
import { Map } from "./index";

const pois: Poi[] = [
  {
    id: "forum-boarium",
    name: "Forum Boarium",
    categories: ["Archaeological Site"],
    city: "Rome",
    coordinates: { lat: 41.889, lng: 12.481 },
    shortDescription: "The ancient cattle market beside the Tiber.",
    mainImageUrl: "https://example.com/forum-boarium.jpg",
    funFacts: [],
  },
  {
    id: "cloisters-of-bramante",
    name: "Cloisters of Bramante",
    categories: ["Church", "Museum"],
    city: "Rome",
    coordinates: { lat: 41.9, lng: 12.47 },
    shortDescription: "A Renaissance cloister by Donato Bramante.",
    funFacts: [],
  },
];

const dispatchPointerEvent = (element: HTMLElement, type: string, pointerType: string) => {
  const event = new Event(type);
  Object.defineProperty(event, "pointerType", { value: pointerType });
  act(() => element.dispatchEvent(event));
};

describe("Map and its MapLibre adapter", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    mapLibreFakes.maps.length = 0;
    mapLibreFakes.markers.length = 0;
    mapLibreFakes.popups.length = 0;
  });

  afterEach(cleanup);

  it("cleans up previews during Strict Mode replay and React unmount without lifecycle errors", async () => {
    const consoleError = vi.spyOn(console, "error");
    try {
      const view = render(
        createElement(
          StrictMode,
          null,
          createElement(Map, { coordinates: [12.481, 41.889], zoom: 15, pois }),
        ),
      );
      dispatchPointerEvent(
        screen.getByRole("button", { name: "Open details for Forum Boarium" }),
        "pointerenter",
        "mouse",
      );
      expect(await screen.findByRole("heading", { name: "Forum Boarium" })).toBeInTheDocument();

      view.unmount();

      await waitFor(() => {
        expect(mapLibreFakes.popups.every(({ element }) => !element?.hasChildNodes())).toBe(true);
      });
      expect(mapLibreFakes.maps.length).toBe(2);
      expect(mapLibreFakes.maps.every(({ removed }) => removed)).toBe(true);
      expect(consoleError.mock.calls.flat().join(" ")).not.toContain(
        "Attempted to synchronously unmount a root",
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  it("keeps the selected Story open when clicking map controls", async () => {
    const user = userEvent.setup();
    const onMapClick = vi.fn();
    const adapter = createMapLibreAdapter({ center: [12.481, 41.889], zoom: 15 });
    const container = document.createElement("div");
    document.body.append(container);
    adapter.setOnMapClick(onMapClick);
    adapter.mount(container);
    const controls = document.createElement("div");
    controls.className = "maplibregl-ctrl";
    const zoomIn = document.createElement("button");
    zoomIn.textContent = "Zoom in";
    controls.append(zoomIn);
    container.append(controls);

    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(onMapClick).not.toHaveBeenCalled();

    await user.click(container);
    expect(onMapClick).toHaveBeenCalledOnce();
    adapter.destroy();
  });

  it("retains selection when markers are created again and restores category styling when cleared", () => {
    const adapter = createMapLibreAdapter({ center: [12.481, 41.889], zoom: 15 });
    const container = document.createElement("div");
    document.body.append(container);
    adapter.updateSelectedPoi("forum-boarium");
    adapter.mount(container);
    adapter.updatePois(pois);

    expect(
      screen.getByRole("button", { name: "Open details for Forum Boarium", pressed: true }),
    ).toHaveClass("selected-poi-marker");
    adapter.updateSelectedPoi("cloisters-of-bramante");
    expect(
      screen.getByRole("button", { name: "Open details for Forum Boarium", pressed: false }),
    ).not.toHaveClass("selected-poi-marker");
    expect(
      screen.getByRole("button", { name: "Open details for Cloisters of Bramante", pressed: true }),
    ).toHaveClass("selected-poi-marker", "religious-site-marker");

    adapter.updatePois([pois[1]]);
    expect(
      screen.getByRole("button", { name: "Open details for Cloisters of Bramante", pressed: true }),
    ).toHaveClass("selected-poi-marker");
    adapter.updateSelectedPoi(null);
    expect(
      screen.getByRole("button", {
        name: "Open details for Cloisters of Bramante",
        pressed: false,
      }),
    ).toHaveClass("religious-site-marker");
    expect(
      screen.getByRole("button", { name: "Open details for Cloisters of Bramante" }),
    ).not.toHaveClass("selected-poi-marker");

    adapter.destroy();
  });

  it("colors a place shared by two groups with the active group's color", () => {
    const adapter = createMapLibreAdapter({ center: [12.481, 41.889], zoom: 15 });
    const container = document.createElement("div");
    document.body.append(container);
    adapter.mount(container);
    const sharedPoi = { ...pois[1], categories: ["Museum", "Castle"] };

    adapter.updatePois([sharedPoi], undefined, ["Architecture", "Castle"]);
    expect(mapLibreFakes.markers.at(-1)?.color).toBe("#ea580c");

    adapter.updatePois([sharedPoi], undefined, ["Arts & Culture", "Museum"]);
    expect(mapLibreFakes.markers.at(-1)?.color).toBe("#10b981");

    adapter.destroy();
  });

  it("shows the matching preview on mouse hover and keyboard focus", async () => {
    render(createElement(Map, { coordinates: [12.481, 41.889], zoom: 15, pois }));

    expect(mapLibreFakes.markers[0].color).toBe("#3FB1CE");
    expect(mapLibreFakes.markers[1].color).toBe("#facc15");
    expect(mapLibreFakes.markers[1].element).toHaveClass("religious-site-marker");
    expect(mapLibreFakes.markers[0].element).toHaveStyle({ cursor: "pointer" });
    dispatchPointerEvent(mapLibreFakes.markers[0].element, "pointerenter", "mouse");
    expect(await screen.findByRole("heading", { name: "Forum Boarium" })).toBeInTheDocument();

    dispatchPointerEvent(mapLibreFakes.markers[0].element, "pointerleave", "mouse");
    expect(screen.getByRole("heading", { name: "Forum Boarium" })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "Forum Boarium" })).not.toBeInTheDocument(),
    );

    act(() => mapLibreFakes.markers[1].element.focus());
    expect(
      await screen.findByRole("heading", { name: "Cloisters of Bramante" }),
    ).toBeInTheDocument();

    act(() => mapLibreFakes.markers[1].element.blur());
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: "Cloisters of Bramante" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("updates preview content before positioning it at another marker", async () => {
    render(createElement(Map, { coordinates: [12.481, 41.889], zoom: 15, pois }));

    dispatchPointerEvent(mapLibreFakes.markers[0].element, "pointerenter", "mouse");
    expect(await screen.findByRole("heading", { name: "Forum Boarium" })).toBeInTheDocument();
    expect(mapLibreFakes.popups[0].positions.at(-1)).toContain("Forum Boarium");

    dispatchPointerEvent(mapLibreFakes.markers[1].element, "pointerenter", "mouse");
    expect(
      await screen.findByRole("heading", { name: "Cloisters of Bramante" }),
    ).toBeInTheDocument();
    expect(mapLibreFakes.popups[0].positions.at(-1)).toContain("Cloisters of Bramante");
    expect(mapLibreFakes.popups[0].positions.at(-1)).not.toContain("Forum Boarium");
  });

  it("keeps the same preview attached when its marker receives hover and focus again", async () => {
    render(createElement(Map, { coordinates: [12.481, 41.889], zoom: 15, pois }));
    const marker = mapLibreFakes.markers[0].element;

    dispatchPointerEvent(marker, "pointerenter", "mouse");
    expect(await screen.findByRole("heading", { name: "Forum Boarium" })).toBeInTheDocument();
    const card = screen.getByRole("button", { name: /Main image of Forum Boarium/ });
    dispatchPointerEvent(marker, "pointerleave", "mouse");
    dispatchPointerEvent(marker, "pointerenter", "mouse");
    act(() => marker.focus());

    expect(screen.getByRole("button", { name: /Main image of Forum Boarium/ })).toBe(card);
    expect(mapLibreFakes.popups[0].additions).toBe(1);
  });

  it("keeps the preview open while moving to the card and opens details from it", async () => {
    const user = userEvent.setup();
    const onOpenPoiDetails = vi.fn();
    const onMapClick = vi.fn();
    render(
      createElement(Map, {
        coordinates: [12.481, 41.889],
        zoom: 15,
        pois,
        onOpenPoiDetails,
        onMapClick,
      }),
    );

    dispatchPointerEvent(mapLibreFakes.markers[0].element, "pointerenter", "mouse");
    expect(await screen.findByRole("heading", { name: "Forum Boarium" })).toBeInTheDocument();

    dispatchPointerEvent(mapLibreFakes.markers[0].element, "pointerleave", "mouse");
    dispatchPointerEvent(mapLibreFakes.popups[0].element as HTMLElement, "pointerenter", "mouse");
    await new Promise((resolve) => setTimeout(resolve, 220));

    await user.click(
      within(mapLibreFakes.popups[0].element as HTMLElement).getByRole("button", {
        name: /Forum Boarium/,
      }),
    );

    expect(onOpenPoiDetails).toHaveBeenCalledWith("forum-boarium");
    expect(onMapClick).not.toHaveBeenCalled();
    expect(mapLibreFakes.popups[0].isOpen).toBe(false);
  });

  it("opens details directly on click, touch, Enter, and Space", async () => {
    const user = userEvent.setup();
    const openedPoiIds: string[] = [];
    render(
      createElement(Map, {
        coordinates: [12.481, 41.889],
        zoom: 15,
        pois,
        onOpenPoiDetails: (poiId) => openedPoiIds.push(poiId),
      }),
    );
    const [firstMarker, secondMarker] = mapLibreFakes.markers;

    await user.click(firstMarker.element);
    dispatchPointerEvent(secondMarker.element, "pointerdown", "touch");
    act(() => {
      secondMarker.element.focus();
      secondMarker.element.click();
      firstMarker.element.focus();
    });
    await user.keyboard("{Enter}");
    act(() => secondMarker.element.focus());
    await user.keyboard(" ");

    expect(openedPoiIds).toEqual([
      "forum-boarium",
      "cloisters-of-bramante",
      "forum-boarium",
      "cloisters-of-bramante",
    ]);
    expect(mapLibreFakes.popups[0].isOpen).toBe(false);
  });

  it("removes marker listeners and closes the popup when destroyed", () => {
    const onOpenPoiDetails = vi.fn();
    const adapter = createMapLibreAdapter({ center: [12.481, 41.889], zoom: 15 });
    const container = document.createElement("div");
    document.body.append(container);
    adapter.setOnOpenPoiDetails(onOpenPoiDetails);
    adapter.mount(container);
    adapter.updatePois(pois);
    const markerElements = mapLibreFakes.markers.map(({ element }) => element);

    adapter.destroy();
    markerElements[0].click();

    expect(onOpenPoiDetails).not.toHaveBeenCalled();
    expect(mapLibreFakes.markers.every(({ removed }) => removed)).toBe(true);
    expect(mapLibreFakes.maps[0].removed).toBe(true);
    expect(mapLibreFakes.popups[0].isOpen).toBe(false);
  });
});
