"use client";

import { useState } from "react";
import { PhotoIcon } from "@heroicons/react/24/outline";
import type { Poi } from "@/types/Poi";

type Props = {
  poi: Poi;
  onOpenDetails: () => void;
};

export const PoiPreviewCard = ({ poi, onOpenDetails }: Props) => {
  const [hasImageError, setHasImageError] = useState(false);
  const showImage = poi.mainImageUrl && !hasImageError;
  const description = poi.previewDescription ?? poi.shortDescription;

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onOpenDetails();
      }}
      className="block w-72 max-w-full cursor-pointer overflow-hidden rounded-xl bg-white text-left shadow-lg ring-1 ring-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
    >
      <div className="relative aspect-2/1 w-full bg-zinc-100">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- Map previews use runtime-selected Wikimedia URLs.
          <img
            src={poi.mainImageUrl}
            alt={`Immagine principale di ${poi.name}`}
            className="absolute inset-0 size-full object-cover"
            onError={() => setHasImageError(true)}
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 text-zinc-500">
            <PhotoIcon className="size-8" aria-hidden="true" />
            <span className="text-xs font-medium">Immagine non disponibile</span>
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 ring-1 ring-black/10 ring-inset" />
      </div>
      <div className="p-4">
        <h3 className="text-base/6 font-semibold text-zinc-900">{poi.name}</h3>
        {description ? (
          <p className="mt-1 line-clamp-3 text-xs/4 text-zinc-600">{description}</p>
        ) : null}
      </div>
    </button>
  );
};
