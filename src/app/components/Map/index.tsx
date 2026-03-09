"use client";

import { useEffect, useRef } from "react";
import type { Poi } from "@/types/Poi";
import { createMapLibreAdapter, MapAdapter } from "./mapAdapter";

type Props = {
  coordinates: [number, number];
  zoom: number;
  pois: Poi[];
  onZoomChange?: (zoom: number) => void;
  onOpenPoiDetails?: (poiId: string) => void;
  onMapClick?: () => void;
};

type MapHandlers = {
  onZoomChange?: Props["onZoomChange"];
  onOpenPoiDetails?: Props["onOpenPoiDetails"];
  onMapClick?: Props["onMapClick"];
};

const ZOOM_EPSILON = 0.001;

export const Map = ({ coordinates, zoom, pois, onZoomChange, onOpenPoiDetails, onMapClick }: Props) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const adapterRef = useRef<MapAdapter | null>(null);
  const lastZoomFromMapRef = useRef<number | null>(null);
  const handlersRef = useRef<MapHandlers>({ onZoomChange, onOpenPoiDetails, onMapClick });
  const lastCenterRef = useRef<[number, number] | null>(null);
  const initialViewRef = useRef({ center: coordinates, zoom });

  useEffect(() => {
    handlersRef.current = { onZoomChange, onOpenPoiDetails, onMapClick };
  }, [onZoomChange, onOpenPoiDetails, onMapClick]);

  useEffect(() => {
    if (adapterRef.current || !containerRef.current) {
      return;
    }

    const adapter = createMapLibreAdapter(initialViewRef.current);
    adapter.setOnZoomChange((value) => {
      lastZoomFromMapRef.current = value;
      handlersRef.current.onZoomChange?.(value);
    });
    adapter.setOnOpenPoiDetails((poiId) => handlersRef.current.onOpenPoiDetails?.(poiId));
    adapter.setOnMapClick(() => handlersRef.current.onMapClick?.());
    adapter.mount(containerRef.current);
    adapterRef.current = adapter;

    return () => {
      adapter.destroy();
      adapterRef.current = null;
    };
  }, []);

  useEffect(() => {
    const adapter = adapterRef.current;
    if (!adapter) {
      return;
    }

    const previousCenter = lastCenterRef.current;
    if (
      !previousCenter ||
      previousCenter[0] !== coordinates[0] ||
      previousCenter[1] !== coordinates[1]
    ) {
      adapter.updateView({ center: coordinates });
      lastCenterRef.current = coordinates;
    }
  }, [coordinates]);

  useEffect(() => {
    const adapter = adapterRef.current;
    if (!adapter) {
      return;
    }

    const zoomFromMap = lastZoomFromMapRef.current;
    if (zoomFromMap !== null && Math.abs(zoomFromMap - zoom) < ZOOM_EPSILON) {
      return;
    }

    const currentZoom = adapter.getZoom();
    if (currentZoom !== null && Math.abs(currentZoom - zoom) < ZOOM_EPSILON) {
      return;
    }

    adapter.updateView({ zoom });
  }, [zoom]);

  useEffect(() => {
    adapterRef.current?.updatePois(pois);
  }, [pois]);

  return <div ref={containerRef} className="h-full w-full" />;
};
