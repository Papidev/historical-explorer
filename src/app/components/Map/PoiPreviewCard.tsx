"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowLongRightIcon, PhotoIcon } from "@heroicons/react/24/outline";
import type { Poi } from "@/types/Poi";

type Props = {
  poi: Poi;
  onOpenDetails: () => void;
};

export const PoiPreviewCard = ({ poi, onOpenDetails }: Props) => {
  const [hasImageError, setHasImageError] = useState(false);
  const description = poi.previewDescription ?? poi.shortDescription;

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onOpenDetails();
      }}
      className="group block w-72 max-w-full cursor-pointer overflow-hidden rounded-xl bg-white text-left shadow-lg ring-1 ring-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
    >
      <div className="relative aspect-2/1 w-full bg-zinc-100">
        {poi.mainImageUrl && !hasImageError ? (
          <Image
            src={poi.mainImageUrl}
            alt={`Main image of ${poi.name}`}
            fill
            sizes="288px"
            className="object-cover"
            onError={() => setHasImageError(true)}
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 text-zinc-500">
            <PhotoIcon className="size-8" aria-hidden="true" />
            <span className="text-xs font-medium">Image unavailable</span>
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 ring-1 ring-black/10 ring-inset" />
        <span
          aria-hidden="true"
          className="bg-brand group-hover:bg-brand-action absolute right-3 bottom-3 flex size-9 items-center justify-center rounded-tl-2xl rounded-tr-md rounded-br-2xl rounded-bl-md text-zinc-900 shadow-sm transition-colors"
        >
          <ArrowLongRightIcon
            className="size-6 -rotate-45 motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5"
            strokeWidth={1.5}
          />
        </span>
      </div>
      <div className="p-4">
        <h3 className="font-serif text-xl/6 tracking-tight text-zinc-900">{poi.name}</h3>
        {description ? (
          <p className="mt-1 line-clamp-3 text-sm/6 text-zinc-600">{description}</p>
        ) : null}
      </div>
    </button>
  );
};
