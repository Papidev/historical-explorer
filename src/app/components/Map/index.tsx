"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { Poi } from "@/types/Poi";
import { DEFAULT_POI_CATEGORY_DEFINITIONS, type PoiCategoryDefinition } from "@/types/PoiCategory";
import "./markers.css";
import "./controls.css";
import { createMapLibreAdapter, type MapAdapter, type MapPreview } from "./mapAdapter";
import { PoiPreviewCard } from "./PoiPreviewCard";

type Props = {
  coordinates: [number, number];
  zoom: number;
  pois: Poi[];
  selectedPoiId?: string | null;
  categoryDefinitions?: PoiCategoryDefinition[];
  onZoomChange?: (zoom: number) => void;
  onOpenPoiDetails?: (poiId: string) => void;
  onMapClick?: () => void;
  controlsRightInset?: number;
  hideControlsOnMobile?: boolean;
};

type MapHandlers = {
  onZoomChange?: Props["onZoomChange"];
  onOpenPoiDetails?: Props["onOpenPoiDetails"];
  onMapClick?: Props["onMapClick"];
};

const ZOOM_EPSILON = 0.001;

export const Map = ({
  coordinates,
  zoom,
  pois,
  selectedPoiId = null,
  categoryDefinitions = DEFAULT_POI_CATEGORY_DEFINITIONS,
  onZoomChange,
  onOpenPoiDetails,
  onMapClick,
  controlsRightInset = 0,
  hideControlsOnMobile = false,
}: Props) => {
  const [preview, setPreview] = useState<MapPreview | null>(null);
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
    adapter.setOnPreviewChange(setPreview);
    adapter.mount(containerRef.current);
    adapterRef.current = adapter;

    return () => {
      adapter.setOnPreviewChange(null);
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
    adapterRef.current?.updatePois(pois, categoryDefinitions);
  }, [pois, categoryDefinitions]);

  useEffect(() => {
    adapterRef.current?.updateSelectedPoi(selectedPoiId);
  }, [selectedPoiId]);

  return (
    <>
      <div
        ref={containerRef}
        className="city-map h-full w-full"
        data-controls-covered={hideControlsOnMobile}
        style={{ "--map-controls-right-inset": `${controlsRightInset}px` } as CSSProperties}
      />
      {preview &&
        createPortal(
          <PoiPreviewCard
            key={preview.poi.id}
            poi={preview.poi}
            onOpenDetails={preview.onOpenDetails}
          />,
          preview.container,
        )}
    </>
  );
};
