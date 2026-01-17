"use client";

import { useEffect, useRef } from "react";
import type { Poi } from "@/types/Poi";
import { createMapLibreAdapter, MapAdapter } from "./mapAdapter";

type Props = {
  coordinates: [number, number];
  zoom: number;
  pois: Poi[];
};

export const Map = ({ coordinates, zoom, pois }: Props) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const adapterRef = useRef<MapAdapter | null>(null);

  useEffect(() => {
    if (adapterRef.current || !containerRef.current) {
      return;
    }

    const adapter = createMapLibreAdapter({ center: coordinates, zoom });
    adapter.mount(containerRef.current);
    adapterRef.current = adapter;

    return () => {
      adapter.destroy();
      adapterRef.current = null;
    };
  }, [coordinates, zoom]);

  useEffect(() => {
    adapterRef.current?.updateView({ center: coordinates, zoom });
  }, [coordinates, zoom]);

  useEffect(() => {
    adapterRef.current?.updatePois(pois);
  }, [pois]);

  return <div ref={containerRef} className="h-full w-full" />;
};
