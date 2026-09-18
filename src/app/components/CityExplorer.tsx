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
  const [openRequestId, setOpenRequestId] = useState(0);
  const selectedPoi = selectedPoiId ? pois.find((poi) => poi.id === selectedPoiId) : undefined;

  return (
    <div className="relative h-full w-full">
      <MapZoomControl zoom={zoom} onChange={setZoom} />
      <Map
        coordinates={coordinates}
        zoom={zoom}
        pois={pois}
        onZoomChange={setZoom}
        onOpenPoiDetails={(poiId) => {
          setSelectedPoiId(poiId);
          setOpenRequestId((current) => current + 1);
        }}
        onMapClick={() => setSelectedPoiId(null)}
      />
      <PoiDetailsDrawer
        key={selectedPoi?.id ?? "closed"}
        citySlug={citySlug}
        openRequestId={openRequestId}
        poi={selectedPoi}
        onClose={() => setSelectedPoiId(null)}
      />
    </div>
  );
};
