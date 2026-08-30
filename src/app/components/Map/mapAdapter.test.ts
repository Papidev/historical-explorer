// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Poi } from "@/types/Poi";

const mapLibreFakes = vi.hoisted(() => ({
  maps: [] as Array<{ container: HTMLDivElement; removed: boolean }>,
  markers: [] as Array<{ element: HTMLDivElement; removed: boolean }>,
  popups: [] as Array<{ element?: HTMLElement; isOpen: boolean }>,
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

    constructor() {
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

import { createMapLibreAdapter } from "./mapAdapter";

const pois: Poi[] = [
  {
    id: "forum-boarium",
    name: "Forum Boarium",
    city: "Rome",
    coordinates: { lat: 41.889, lng: 12.481 },
    shortDescription: "The ancient cattle market beside the Tiber.",
    mainImageUrl: "https://example.com/forum-boarium.jpg",
    funFacts: [],
  },
  {
    id: "cloisters-of-bramante",
    name: "Cloisters of Bramante",
    city: "Rome",
    coordinates: { lat: 41.9, lng: 12.47 },
    shortDescription: "A Renaissance cloister by Donato Bramante.",
    funFacts: [],
  },
];

const dispatchPointerEvent = (element: HTMLElement, type: string, pointerType: string) => {
  const event = new Event(type);
  Object.defineProperty(event, "pointerType", { value: pointerType });
  element.dispatchEvent(event);
};

describe("createMapLibreAdapter", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    mapLibreFakes.maps.length = 0;
    mapLibreFakes.markers.length = 0;
    mapLibreFakes.popups.length = 0;
  });

  afterEach(cleanup);

  it("shows the matching preview on mouse hover and keyboard focus", async () => {
    const adapter = createMapLibreAdapter({ center: [12.481, 41.889], zoom: 15 });
    const container = document.createElement("div");
    document.body.append(container);
    adapter.mount(container);
    adapter.updatePois(pois);

    expect(mapLibreFakes.markers[0].element).toHaveStyle({ cursor: "pointer" });
    dispatchPointerEvent(mapLibreFakes.markers[0].element, "pointerenter", "mouse");
    expect(await screen.findByRole("heading", { name: "Forum Boarium" })).toBeInTheDocument();

    dispatchPointerEvent(mapLibreFakes.markers[0].element, "pointerleave", "mouse");
    expect(screen.getByRole("heading", { name: "Forum Boarium" })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "Forum Boarium" })).not.toBeInTheDocument(),
    );

    mapLibreFakes.markers[1].element.focus();
    expect(
      await screen.findByRole("heading", { name: "Cloisters of Bramante" }),
    ).toBeInTheDocument();

    mapLibreFakes.markers[1].element.blur();
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: "Cloisters of Bramante" }),
      ).not.toBeInTheDocument(),
    );

    adapter.destroy();
  });

  it("keeps the preview open while moving to the card and opens details from it", async () => {
    const user = userEvent.setup();
    const onOpenPoiDetails = vi.fn();
    const onMapClick = vi.fn();
    const adapter = createMapLibreAdapter({ center: [12.481, 41.889], zoom: 15 });
    const container = document.createElement("div");
    document.body.append(container);
    adapter.setOnOpenPoiDetails(onOpenPoiDetails);
    adapter.setOnMapClick(onMapClick);
    adapter.mount(container);
    adapter.updatePois(pois);

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

    adapter.destroy();
  });

  it("opens details directly on click, touch, Enter, and Space", async () => {
    const user = userEvent.setup();
    const openedPoiIds: string[] = [];
    const adapter = createMapLibreAdapter({ center: [12.481, 41.889], zoom: 15 });
    const container = document.createElement("div");
    document.body.append(container);
    adapter.setOnOpenPoiDetails((poiId) => openedPoiIds.push(poiId));
    adapter.mount(container);
    adapter.updatePois(pois);
    const [firstMarker, secondMarker] = mapLibreFakes.markers;

    await user.click(firstMarker.element);
    dispatchPointerEvent(secondMarker.element, "pointerdown", "touch");
    secondMarker.element.focus();
    secondMarker.element.click();
    firstMarker.element.focus();
    await user.keyboard("{Enter}");
    secondMarker.element.focus();
    await user.keyboard(" ");

    expect(openedPoiIds).toEqual([
      "forum-boarium",
      "cloisters-of-bramante",
      "forum-boarium",
      "cloisters-of-bramante",
    ]);
    expect(mapLibreFakes.popups[0].isOpen).toBe(false);

    adapter.destroy();
  });

  it("removes marker listeners and the React preview when destroyed", () => {
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
