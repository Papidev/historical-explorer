"use client";

import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import maplibregl, { Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Poi } from "@/types/Poi";
import { PoiPreviewCard } from "./PoiPreviewCard";

const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const PREVIEW_CLOSE_DELAY_MS = 180;

export type MapView = {
  center: [number, number];
  zoom: number;
};

export type MapViewUpdate = {
  center?: [number, number];
  zoom?: number;
};

export interface MapAdapter {
  mount: (container: HTMLDivElement) => void;
  updateView: (view: MapViewUpdate) => void;
  updatePois: (points: Poi[]) => void;
  getZoom: () => number | null;
  setOnZoomChange: (handler: ((zoom: number) => void) | null) => void;
  setOnOpenPoiDetails: (handler: ((poiId: string) => void) | null) => void;
  setOnMapClick: (handler: (() => void) | null) => void;
  destroy: () => void;
}

type MarkerBinding = {
  marker: Marker;
  removeListeners: () => void;
};

export const createMapLibreAdapter = (initialView: MapView): MapAdapter => {
  let map: MapLibreMap | null = null;
  let markers: MarkerBinding[] = [];
  let previewPopup: maplibregl.Popup | null = null;
  let previewRoot: Root | null = null;
  let previewContainer: HTMLDivElement | null = null;
  let activePreviewPoiId: string | null = null;
  let previewCloseTimeout: ReturnType<typeof setTimeout> | null = null;
  let isLoaded = false;
  let pendingPois: Poi[] | null = null;
  let onZoomChange: ((zoom: number) => void) | null = null;
  let onOpenPoiDetails: ((poiId: string) => void) | null = null;
  let onMapClick: (() => void) | null = null;

  const handleMapClick = () => onMapClick?.();

  const cancelPreviewClose = () => {
    if (previewCloseTimeout) {
      clearTimeout(previewCloseTimeout);
      previewCloseTimeout = null;
    }
  };

  const closePreview = (poiId?: string) => {
    if (poiId && activePreviewPoiId !== poiId) {
      return;
    }

    cancelPreviewClose();
    previewPopup?.remove();
    activePreviewPoiId = null;
  };

  const schedulePreviewClose = (poiId?: string) => {
    cancelPreviewClose();
    previewCloseTimeout = setTimeout(() => {
      previewCloseTimeout = null;
      closePreview(poiId);
    }, PREVIEW_CLOSE_DELAY_MS);
  };

  const handlePreviewPointerEnter = () => cancelPreviewClose();
  const handlePreviewPointerLeave = () => schedulePreviewClose(activePreviewPoiId ?? undefined);
  const handlePreviewFocusIn = () => cancelPreviewClose();
  const handlePreviewFocusOut = (event: FocusEvent) => {
    if (!previewContainer?.contains(event.relatedTarget as Node | null)) {
      schedulePreviewClose(activePreviewPoiId ?? undefined);
    }
  };

  const openPreview = (poi: Poi) => {
    if (!map || !previewPopup || !previewRoot) {
      return;
    }

    cancelPreviewClose();
    activePreviewPoiId = poi.id;
    previewRoot.render(
      createElement(PoiPreviewCard, {
        key: poi.id,
        poi,
        onOpenDetails: () => {
          closePreview();
          onOpenPoiDetails?.(poi.id);
        },
      }),
    );
    previewPopup.setLngLat([poi.coordinates.lng, poi.coordinates.lat]).addTo(map);
    const popupElement = previewPopup.getElement();
    const popupContent = popupElement.querySelector<HTMLElement>(".maplibregl-popup-content");
    popupElement.style.pointerEvents = "auto";
    if (popupContent) {
      popupContent.style.overflow = "hidden";
      popupContent.style.borderRadius = "var(--radius-xl)";
      popupContent.style.background = "transparent";
      popupContent.style.padding = "0";
      popupContent.style.boxShadow = "none";
      popupContent.style.pointerEvents = "auto";
    }
  };

  const removeMarkers = () => {
    closePreview();
    markers.forEach(({ marker, removeListeners }) => {
      removeListeners();
      marker.remove();
    });
    markers = [];
  };

  const setMarkers = (points: Poi[]) => {
    if (!map) {
      return;
    }

    removeMarkers();
    markers = points.map((poi) => {
      const marker = new maplibregl.Marker()
        .setLngLat([poi.coordinates.lng, poi.coordinates.lat])
        .addTo(map as MapLibreMap);
      const element = marker.getElement();
      let isTouchInteraction = false;

      element.style.cursor = "pointer";
      element.tabIndex = 0;
      element.setAttribute("role", "button");
      element.setAttribute("aria-label", `Open details for ${poi.name}`);

      const handlePointerDown = (event: PointerEvent) => {
        isTouchInteraction = event.pointerType === "touch";
      };
      const handlePointerEnter = (event: PointerEvent) => {
        if (event.pointerType !== "touch") {
          openPreview(poi);
        }
      };
      const handlePointerLeave = () => schedulePreviewClose(poi.id);
      const handleFocus = () => {
        if (!isTouchInteraction) {
          openPreview(poi);
        }
      };
      const handleBlur = () => {
        isTouchInteraction = false;
        schedulePreviewClose(poi.id);
      };
      const handleClick = (event: MouseEvent) => {
        event.stopPropagation();
        isTouchInteraction = false;
        closePreview();
        onOpenPoiDetails?.(poi.id);
      };
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        closePreview();
        onOpenPoiDetails?.(poi.id);
      };

      element.addEventListener("pointerdown", handlePointerDown);
      element.addEventListener("pointerenter", handlePointerEnter);
      element.addEventListener("pointerleave", handlePointerLeave);
      element.addEventListener("focus", handleFocus);
      element.addEventListener("blur", handleBlur);
      element.addEventListener("click", handleClick);
      element.addEventListener("keydown", handleKeyDown);

      return {
        marker,
        removeListeners: () => {
          element.removeEventListener("pointerdown", handlePointerDown);
          element.removeEventListener("pointerenter", handlePointerEnter);
          element.removeEventListener("pointerleave", handlePointerLeave);
          element.removeEventListener("focus", handleFocus);
          element.removeEventListener("blur", handleBlur);
          element.removeEventListener("click", handleClick);
          element.removeEventListener("keydown", handleKeyDown);
        },
      };
    });
  };

  return {
    mount(container) {
      if (map) {
        return;
      }

      map = new maplibregl.Map({
        container,
        style: MAP_STYLE_URL,
        center: initialView.center,
        zoom: initialView.zoom,
      });

      map.addControl(new maplibregl.NavigationControl(), "top-right");
      previewContainer = document.createElement("div");
      previewContainer.addEventListener("pointerenter", handlePreviewPointerEnter);
      previewContainer.addEventListener("pointerleave", handlePreviewPointerLeave);
      previewContainer.addEventListener("focusin", handlePreviewFocusIn);
      previewContainer.addEventListener("focusout", handlePreviewFocusOut);
      previewRoot = createRoot(previewContainer);
      previewPopup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        focusAfterOpen: false,
        maxWidth: "calc(100vw - 2rem)",
        offset: 16,
      }).setDOMContent(previewContainer);
      map.on("zoomend", () => {
        if (!map || !onZoomChange) {
          return;
        }
        onZoomChange(map.getZoom());
      });
      map.once("load", () => {
        isLoaded = true;
        if (pendingPois) {
          setMarkers(pendingPois);
          pendingPois = null;
        }
      });
      map.getContainer().addEventListener("click", handleMapClick);
    },
    updateView(view) {
      if (!map) {
        return;
      }

      const nextView: { center?: [number, number]; zoom?: number } = {};

      if (view.center) {
        nextView.center = view.center;
      }

      if (view.zoom !== undefined) {
        nextView.zoom = view.zoom;
      }

      if (Object.keys(nextView).length === 0) {
        return;
      }

      map.easeTo(nextView);
    },
    updatePois(points) {
      if (!map) {
        return;
      }

      if (!isLoaded) {
        pendingPois = points;
        return;
      }

      setMarkers(points);
    },
    getZoom() {
      return map ? map.getZoom() : null;
    },
    setOnZoomChange(handler) {
      onZoomChange = handler;
    },
    setOnOpenPoiDetails(handler) {
      onOpenPoiDetails = handler;
    },
    setOnMapClick(handler) {
      onMapClick = handler;
    },
    destroy() {
      map?.getContainer().removeEventListener("click", handleMapClick);
      removeMarkers();
      previewContainer?.removeEventListener("pointerenter", handlePreviewPointerEnter);
      previewContainer?.removeEventListener("pointerleave", handlePreviewPointerLeave);
      previewContainer?.removeEventListener("focusin", handlePreviewFocusIn);
      previewContainer?.removeEventListener("focusout", handlePreviewFocusOut);
      previewRoot?.unmount();
      previewRoot = null;
      previewContainer = null;
      previewPopup?.remove();
      previewPopup = null;
      map?.remove();
      map = null;
      pendingPois = null;
      isLoaded = false;
    },
  };
};
