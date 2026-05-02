"use client";

import { useEffect, useState } from "react";
import { MDXRemote, type MDXRemoteSerializeResult } from "next-mdx-remote";
import type { Poi } from "@/types/Poi";
import { Map } from "@/app/components/Map";
import { Callout } from "@/app/components/mdx/Callout";
import { MdxLink } from "@/app/components/mdx/MdxLink";

type Props = {
  citySlug: string;
  coordinates: [number, number];
  initialZoom: number;
  initialSelectedPoiId?: string | null;
  pois: Poi[];
};

type DialogContentState = {
  content: MDXRemoteSerializeResult | null;
  isLoading: boolean;
  poiId: string | null;
};

export const RomeMapClient = ({
  citySlug,
  coordinates,
  initialZoom,
  initialSelectedPoiId = null,
  pois,
}: Props) => {
  const [zoom, setZoom] = useState(initialZoom);
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(initialSelectedPoiId);
  const [dialogContentState, setDialogContentState] = useState<DialogContentState>({
    content: null,
    isLoading: false,
    poiId: null,
  });
  const displayZoom = Number(zoom.toFixed(2));
  const selectedPoi = selectedPoiId ? pois.find((poi) => poi.id === selectedPoiId) : undefined;
  const dialogContentMdx = dialogContentState.poiId === selectedPoi?.id ? dialogContentState.content : null;
  const isLoadingDialogContent = dialogContentState.poiId === selectedPoi?.id && dialogContentState.isLoading;

  useEffect(() => {
    if (!selectedPoi?.contentSlug) {
      return;
    }
    const contentSlug = selectedPoi.contentSlug;
    const poiId = selectedPoi.id;

    const abortController = new AbortController();

    const loadDialogContent = async () => {
      setDialogContentState({ content: null, isLoading: true, poiId });

      try {
        const response = await fetch(
          `/api/pois/${encodeURIComponent(citySlug)}/${encodeURIComponent(poiId)}/dialog-content?contentSlug=${encodeURIComponent(contentSlug)}`,
          { signal: abortController.signal },
        );

        if (!response.ok) {
          setDialogContentState({ content: null, isLoading: false, poiId });
          return;
        }

        const payload = (await response.json()) as {
          content?: MDXRemoteSerializeResult | null;
        };
        setDialogContentState({ content: payload.content ?? null, isLoading: false, poiId });
      } catch {
        if (!abortController.signal.aborted) {
          setDialogContentState({ content: null, isLoading: false, poiId });
        }
      }
    };

    void loadDialogContent();

    return () => {
      abortController.abort();
    };
  }, [citySlug, selectedPoi?.contentSlug, selectedPoi?.id]);

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
        onOpenPoiDetails={(poiId) => setSelectedPoiId(poiId)}
        onMapClick={() => setSelectedPoiId(null)}
      />
      <aside
        className={`absolute right-0 top-0 z-20 h-full w-full max-w-md border-l border-black/10 bg-white shadow-2xl transition-transform duration-300 ${
          selectedPoi ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!selectedPoi}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between border-b border-black/10 px-5 py-4">
            <div>
              <h2 className="text-2xl font-semibold leading-tight text-black">{selectedPoi?.name ?? "Dettagli POI"}</h2>
            </div>
            <button
              type="button"
              className="rounded-md border border-black/20 px-2 py-1 text-sm text-black hover:bg-black/5"
              onClick={() => setSelectedPoiId(null)}
            >
              Chiudi
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-4 text-sm leading-6 text-black/80">
            {selectedPoi ? (
              <>
                {selectedPoi.shortDescription ? <p>{selectedPoi.shortDescription}</p> : null}
                {isLoadingDialogContent ? (
                  <p className="mt-4 text-black/60">Caricamento contenuto aggiuntivo...</p>
                ) : dialogContentMdx ? (
                  <div className="poi-dialog-content mt-4">
                    <MDXRemote {...dialogContentMdx} components={{ Callout, a: MdxLink }} />
                  </div>
                ) : (
                  <p className="mt-4 text-black/60">
                    Nessun contenuto aggiuntivo disponibile per questo punto.
                  </p>
                )}
              </>
            ) : null}
          </div>
        </div>
      </aside>
    </div>
  );
};
