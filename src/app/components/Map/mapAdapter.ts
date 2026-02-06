"use client";

import maplibregl, { Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Poi } from "@/types/Poi";

const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

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
  destroy: () => void;
}

const createMarker = (map: MapLibreMap, poi: Poi) =>
  new maplibregl.Marker()
    .setLngLat([poi.coordinates.lng, poi.coordinates.lat])
    .setPopup(
      new maplibregl.Popup({ offset: 16 }).setHTML(`
        <strong>${poi.name}</strong><br/>
        <em>${poi.period}</em><br/>
        <small>${poi.shortDescription}</small>
      `),
    )
    .addTo(map);

export const createMapLibreAdapter = (initialView: MapView): MapAdapter => {
  let map: MapLibreMap | null = null;
  let markers: Marker[] = [];
  let isLoaded = false;
  let pendingPois: Poi[] | null = null;
  let onZoomChange: ((zoom: number) => void) | null = null;

  const setMarkers = (points: Poi[]) => {
    if (!map) {
      return;
    }

    markers.forEach((marker) => marker.remove());
    markers = points.map((poi) => createMarker(map as MapLibreMap, poi));
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
    destroy() {
      markers.forEach((marker) => marker.remove());
      markers = [];
      map?.remove();
      map = null;
      pendingPois = null;
      isLoaded = false;
    },
  };
};
