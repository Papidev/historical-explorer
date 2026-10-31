"use client";

import maplibregl, { Map as MapLibreMap, Marker, type ExpressionSpecification } from "maplibre-gl";
import type { Poi } from "@/types/Poi";
import { categoryMarkerColors } from "@/app/components/categoryMarkerColors";
import {
  DEFAULT_POI_CATEGORY_DEFINITIONS,
  matchesPoiCategory,
  type PoiCategory,
  type PoiCategoryDefinition,
} from "@/types/PoiCategory";

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

export type MapPreview = {
  poi: Poi;
  container: HTMLDivElement;
  onOpenDetails: () => void;
};

export interface MapAdapter {
  mount: (container: HTMLDivElement) => void;
  updateView: (view: MapViewUpdate) => void;
  updatePois: (
    points: Poi[],
    definitions?: PoiCategoryDefinition[],
    selectedCategories?: PoiCategory[],
  ) => void;
  updateSelectedPoi: (poiId: string | null) => void;
  focusPoi: (request: { poi: Poi; leftInset: number; rightInset: number }) => void;
  getZoom: () => number | null;
  setOnZoomChange: (handler: ((zoom: number) => void) | null) => void;
  setOnOpenPoiDetails: (handler: ((poiId: string) => void) | null) => void;
  setOnMapClick: (handler: (() => void) | null) => void;
  setOnPreviewChange: (handler: ((preview: MapPreview | null) => void) | null) => void;
  destroy: () => void;
}

type MarkerBinding = {
  poiId: string;
  marker: Marker;
  removeListeners: () => void;
};

export const createMapLibreAdapter = (initialView: MapView): MapAdapter => {
  let map: MapLibreMap | null = null;
  let markers: MarkerBinding[] = [];
  let selectedPoiId: string | null = null;
  let previewPopup: maplibregl.Popup | null = null;
  let previewContainer: HTMLDivElement | null = null;
  let activePreviewPoiId: string | null = null;
  let previewCloseTimeout: ReturnType<typeof setTimeout> | null = null;
  let isLoaded = false;
  let pendingPois: Poi[] | null = null;
  let categoryDefinitions = DEFAULT_POI_CATEGORY_DEFINITIONS;
  let selectedCategories: PoiCategory[] | undefined;
  let onZoomChange: ((zoom: number) => void) | null = null;
  let onOpenPoiDetails: ((poiId: string) => void) | null = null;
  let onMapClick: (() => void) | null = null;
  let onPreviewChange: ((preview: MapPreview | null) => void) | null = null;

  const handleMapClick = (event: MouseEvent) => {
    if (event.target instanceof Element && event.target.closest(".maplibregl-ctrl")) return;
    onMapClick?.();
  };

  const updateMarkerSelection = () => {
    markers.forEach(({ poiId, marker }) => {
      marker.getElement().classList.toggle("selected-poi-marker", poiId === selectedPoiId);
      marker.getElement().setAttribute("aria-pressed", String(poiId === selectedPoiId));
    });
  };

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
    if (activePreviewPoiId !== null) {
      onPreviewChange?.(null);
    }
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
    if (!map || !previewPopup || !previewContainer) {
      return;
    }

    cancelPreviewClose();
    if (activePreviewPoiId === poi.id) return;
    const isPreviewOpen = activePreviewPoiId !== null;
    activePreviewPoiId = poi.id;
    onPreviewChange?.({
      poi,
      container: previewContainer,
      onOpenDetails: () => {
        closePreview();
        onOpenPoiDetails?.(poi.id);
      },
    });
    previewPopup.setLngLat([poi.coordinates.lng, poi.coordinates.lat]);
    if (!isPreviewOpen) previewPopup.addTo(map);
    const popupElement = previewPopup.getElement();
    const popupContent = popupElement.querySelector<HTMLElement>(".maplibregl-popup-content");
    popupElement.style.pointerEvents = "auto";
    if (popupContent) {
      popupContent.style.overflow = "hidden";
      popupContent.style.borderRadius = "var(--radius-xl)";
      popupContent.style.background = "transparent";
      popupContent.style.padding = "0";
      popupContent.style.boxShadow = "var(--shadow-xl)";
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
      const matchingColors = categoryMarkerColors.filter(({ category }) =>
        matchesPoiCategory(poi.categories, category, categoryDefinitions),
      );
      const markerColor =
        matchingColors.find(({ category }) =>
          selectedCategories?.some(
            (selected) =>
              (selected === category ||
                categoryDefinitions.some(
                  ({ id, parent }) => id === selected && parent === category,
                )) &&
              matchesPoiCategory(poi.categories, selected, categoryDefinitions),
          ),
        ) ?? matchingColors[0];
      const marker = new maplibregl.Marker({ color: markerColor?.marker, scale: 1.15 })
        .setLngLat([poi.coordinates.lng, poi.coordinates.lat])
        .addTo(map as MapLibreMap);
      const element = marker.getElement();
      const markerCenter = element.querySelector('circle[fill="#FFFFFF"]');
      if (markerCenter && markerColor) {
        const icon = document.createElementNS("http://www.w3.org/2000/svg", "image");
        icon.setAttribute("href", markerColor.icon);
        icon.setAttribute("x", "-2.5");
        icon.setAttribute("y", "-2.5");
        icon.setAttribute("width", "16");
        icon.setAttribute("height", "16");
        icon.setAttribute("aria-hidden", "true");
        markerCenter.parentElement?.replaceChildren(icon);
      }
      let isTouchInteraction = false;

      element.classList.add("poi-marker");
      if (markerColor?.category === "Churches & cathedrals") {
        // Scope styling to MapLibre’s generated marker; preserve its shape and shadow.
        element.classList.add("religious-site-marker");
      } else if (markerColor?.category === "Arts & Culture") {
        element.classList.add("arts-culture-marker");
      }
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
        poiId: poi.id,
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
    updateMarkerSelection();
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

      const navigationControl = new maplibregl.NavigationControl();
      const zoomValue = document.createElement("output");
      zoomValue.className = "map-zoom-value";
      zoomValue.setAttribute("aria-label", "Zoom level");
      const updateZoomValue = () => {
        if (map) zoomValue.value = map.getZoom().toFixed(2);
      };
      map.addControl(
        {
          onAdd: (map) => {
            const container = navigationControl.onAdd(map);
            container.append(zoomValue);
            updateZoomValue();
            map.on("zoom", updateZoomValue);
            return container;
          },
          onRemove: () => {
            map?.off("zoom", updateZoomValue);
            navigationControl.onRemove();
          },
        },
        "top-right",
      );
      previewContainer = document.createElement("div");
      previewContainer.addEventListener("pointerenter", handlePreviewPointerEnter);
      previewContainer.addEventListener("pointerleave", handlePreviewPointerLeave);
      previewContainer.addEventListener("focusin", handlePreviewFocusIn);
      previewContainer.addEventListener("focusout", handlePreviewFocusOut);
      previewPopup = new maplibregl.Popup({
        className: "poi-preview-popup cursor-pointer",
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
        for (const layer of map?.getStyle().layers ?? []) {
          if (layer.type !== "symbol" || layer["source-layer"] !== "poi") {
            continue;
          }

          map?.setFilter(layer.id, [
            "all",
            // Liberty uses expression filters; preserve its geometry and zoom-rank restrictions.
            (layer.filter as ExpressionSpecification | undefined) ?? true,
            [
              "any",
              [
                "match",
                ["get", "class"],
                [
                  "museum",
                  "monument",
                  "memorial",
                  "castle",
                  "archaeological_site",
                  "place_of_worship",
                  "theatre",
                ],
                true,
                false,
              ],
              [
                "match",
                ["get", "subclass"],
                ["artwork", "gallery", "arts_centre", "library"],
                true,
                false,
              ],
            ],
          ]);
        }

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
    updatePois(points, definitions = DEFAULT_POI_CATEGORY_DEFINITIONS, selection) {
      categoryDefinitions = definitions;
      selectedCategories = selection;
      if (!map) {
        return;
      }

      if (!isLoaded) {
        pendingPois = points;
        return;
      }

      setMarkers(points);
    },
    updateSelectedPoi(poiId) {
      selectedPoiId = poiId;
      updateMarkerSelection();
    },
    focusPoi({ poi, leftInset, rightInset }) {
      if (!map) return;
      closePreview();
      map.easeTo({
        center: [poi.coordinates.lng, poi.coordinates.lat],
        // Mobile Stories cover the map; keep the place centered for the return to it.
        offset: window.innerWidth >= 768 ? [(leftInset - rightInset) / 2, 0] : [0, 0],
      });
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
    setOnPreviewChange(handler) {
      onPreviewChange = handler;
    },
    destroy() {
      map?.getContainer().removeEventListener("click", handleMapClick);
      removeMarkers();
      previewContainer?.removeEventListener("pointerenter", handlePreviewPointerEnter);
      previewContainer?.removeEventListener("pointerleave", handlePreviewPointerLeave);
      previewContainer?.removeEventListener("focusin", handlePreviewFocusIn);
      previewContainer?.removeEventListener("focusout", handlePreviewFocusOut);
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
