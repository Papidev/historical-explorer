"use client";

import { useEffect, useRef } from "react";
import type { Poi } from "@/types/Poi";
import { createMapLibreAdapter, MapAdapter } from "./mapAdapter";

type Props = {
  coordinates: [number, number];
  zoom: number;
  pois: Poi[];
  onZoomChange?: (zoom: number) => void;
};

const ZOOM_EPSILON = 0.001;

export const Map = ({ coordinates, zoom, pois, onZoomChange }: Props) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const adapterRef = useRef<MapAdapter | null>(null);
  const lastZoomFromMapRef = useRef<number | null>(null);
  const onZoomChangeRef = useRef<Props["onZoomChange"]>(onZoomChange);
  const lastCenterRef = useRef<[number, number] | null>(null);

  onZoomChangeRef.current = onZoomChange;

  useEffect(() => {
    if (adapterRef.current || !containerRef.current) {
      return;
    }

    const adapter = createMapLibreAdapter({ center: coordinates, zoom });
    adapter.setOnZoomChange((value) => {
      lastZoomFromMapRef.current = value;
      onZoomChangeRef.current?.(value);
    });
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
