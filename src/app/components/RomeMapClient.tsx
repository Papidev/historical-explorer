"use client";

import { useState } from "react";
import type { Poi } from "@/types/Poi";
import { Map } from "@/app/components/Map";

type Props = {
  coordinates: [number, number];
  initialZoom: number;
  pois: Poi[];
};

export const RomeMapClient = ({ coordinates, initialZoom, pois }: Props) => {
  const [zoom, setZoom] = useState(initialZoom);
  const displayZoom = Number(zoom.toFixed(2));

  return (
    <div className="relative h-full w-full">
      <div className="absolute left-4 top-4 z-10 rounded-lg border border-white/10 bg-amber-100 px-3 py-2 text-xs text-black shadow-lg backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="font-semibold">Zoom</span>
          <span className="tabular-nums">{displayZoom}</span>
        </div>
        <label className="mt-2 block text-[11px] font-medium text-white/70" htmlFor="rome-zoom">
          Change zoom
        </label>
        <input
          id="rome-zoom"
          className="mt-1 w-full rounded-md border border-white/20 bg-black/60 px-2 py-1 text-xs text-white"
          type="number"
          value={displayZoom}
          min={0}
          max={22}
          step={0.01}
          onChange={(event) => {
            const value = Number(event.target.value);
            if (Number.isNaN(value)) {
              return;
            }
            setZoom(value);
          }}
        />
      </div>
      <Map
        coordinates={coordinates}
        zoom={zoom}
        pois={pois}
        onZoomChange={(value) => setZoom(value)}
      />
    </div>
  );
};
