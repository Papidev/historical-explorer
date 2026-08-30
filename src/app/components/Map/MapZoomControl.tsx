"use client";

import { useId } from "react";

export const MapZoomControl = ({
  onChange,
  zoom,
}: {
  onChange: (zoom: number) => void;
  zoom: number;
}) => {
  const inputId = useId();
  const displayZoom = Number(zoom.toFixed(2));

  return (
    <div className="absolute top-4 left-4 z-10 rounded-lg border border-white/10 bg-amber-100 px-3 py-2 text-xs text-black shadow-lg backdrop-blur">
      <label className="block font-semibold" htmlFor={inputId}>
        Zoom
      </label>
      <input
        id={inputId}
        className="mt-1 w-full rounded-md border border-white/20 bg-black/60 px-2 py-1 text-xs text-white tabular-nums"
        type="number"
        value={displayZoom}
        min={0}
        max={22}
        step={0.01}
        onChange={(event) => {
          const value = Number(event.target.value);
          if (!Number.isNaN(value)) {
            onChange(value);
          }
        }}
      />
    </div>
  );
};
