"use client";

import { useState } from "react";
import type { Poi } from "@/types/Poi";
import { Map } from "@/app/components/Map";
import { MapZoomControl } from "@/app/components/Map/MapZoomControl";
import { PoiDetailsDrawer } from "@/app/components/PoiDetailsDrawer";

type Props = {
  citySlug: string;
  coordinates: [number, number];
  initialZoom: number;
  initialSelectedPoiId?: string | null;
  pois: Poi[];
};

export const CityExplorer = ({
  citySlug,
  coordinates,
  initialZoom,
  initialSelectedPoiId = null,
  pois,
}: Props) => {
  const [zoom, setZoom] = useState(initialZoom);
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(initialSelectedPoiId);
  const selectedPoi = selectedPoiId ? pois.find((poi) => poi.id === selectedPoiId) : undefined;

  return (
    <div className="relative h-full w-full">
      <MapZoomControl zoom={zoom} onChange={setZoom} />
      <Map
        coordinates={coordinates}
        zoom={zoom}
        pois={pois}
        onZoomChange={setZoom}
        onOpenPoiDetails={setSelectedPoiId}
        onMapClick={() => setSelectedPoiId(null)}
      />
      <PoiDetailsDrawer
        citySlug={citySlug}
        poi={selectedPoi}
        onClose={() => setSelectedPoiId(null)}
      />
    </div>
  );
};
