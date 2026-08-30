"use client";

import { useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import type { Poi } from "@/types/Poi";
import { StoryContent } from "@/app/components/StoryContent";
import { IconButton } from "@/app/components/ui/IconButton";
import { usePoiStoryContent } from "@/app/components/usePoiStoryContent";

export const PoiDetailsDrawer = ({
  citySlug,
  onClose,
  poi,
}: {
  citySlug: string;
  onClose: () => void;
  poi?: Poi;
}) => {
  const [failedMainImageUrl, setFailedMainImageUrl] = useState<string | null>(null);
  const { content, isLoading } = usePoiStoryContent({ citySlug, poiId: poi?.id });

  return (
    <aside
      className={`absolute top-0 right-0 z-20 h-full w-full max-w-md border-l border-black/10 bg-white shadow-2xl transition-transform duration-300 ${
        poi ? "translate-x-0" : "translate-x-full"
      }`}
      aria-hidden={!poi}
    >
      {poi ? (
        <div className="flex h-full flex-col">
          <IconButton
            label="Close"
            size="large"
            className="absolute top-4 right-4 z-10 bg-white/90 shadow-md backdrop-blur hover:bg-white"
            onClick={onClose}
          >
            <XMarkIcon aria-hidden="true" />
          </IconButton>
          {poi.mainImageUrl && poi.mainImageUrl !== failedMainImageUrl ? (
            <div className="aspect-video w-full shrink-0 overflow-hidden bg-zinc-100">
              {/* eslint-disable-next-line @next/next/no-img-element -- POI images use runtime-selected Wikimedia URLs. */}
              <img
                src={poi.mainImageUrl}
                alt={`Main image of ${poi.name}`}
                className="size-full object-cover"
                onError={() => setFailedMainImageUrl(poi.mainImageUrl ?? null)}
              />
            </div>
          ) : null}
          <div className="border-b border-black/10 px-5 py-4 pr-16">
            <h2 className="text-2xl leading-tight font-semibold text-black">{poi.name}</h2>
          </div>
          <div className="overflow-y-auto px-5 py-4 text-sm leading-6 text-black/80">
            {poi.shortDescription ? <p>{poi.shortDescription}</p> : null}
            {isLoading ? (
              <p className="mt-4 text-black/60">Loading additional content...</p>
            ) : content ? (
              <StoryContent content={content} period={poi.period} address={poi.address} />
            ) : (
              <p className="mt-4 text-black/60">
                No additional content is available for this point.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </aside>
  );
};
