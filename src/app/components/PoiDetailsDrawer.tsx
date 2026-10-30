"use client";

import { useState } from "react";
import { PoiImageGallery } from "@/app/components/PoiImageGallery";
import Image from "next/image";
import { Drawer } from "@/app/components/ui/Drawer";
import { PanelResizeHandle } from "@/app/components/ui/PanelResizeHandle";
import { ArrowLeftIcon, PhotoIcon } from "@heroicons/react/24/outline";
import type { Poi } from "@/types/Poi";
import { StoryContent } from "@/app/components/StoryContent";
import { DrawerCloseButton } from "@/app/components/ui/DrawerCloseButton";
import { usePoiStoryContent } from "@/app/components/usePoiStoryContent";
import { Person } from "@/app/components/Person";
import { usePerson } from "@/app/components/usePerson";

export const PoiDetailsDrawer = ({
  citySlug,
  onClose,
  openRequestId = 0,
  poi: selectedPoi,
  width,
  onResize,
  excludedByFilters = false,
}: {
  citySlug: string;
  onClose: () => void;
  openRequestId?: number;
  poi?: Poi;
  width?: number;
  onResize?: (width: number) => void;
  excludedByFilters?: boolean;
}) => {
  const [poi, setPoi] = useState(selectedPoi);
  if (selectedPoi && selectedPoi !== poi) setPoi(selectedPoi);
  const [failedMainImageUrl, setFailedMainImageUrl] = useState<string | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<{
    id: string;
    openRequestId: number;
  }>();
  const selectedPersonId =
    selectedPerson?.openRequestId === openRequestId ? selectedPerson.id : undefined;
  const { content, detail, isLoading, showLoading } = usePoiStoryContent({
    citySlug,
    poiId: poi?.id,
  });
  const mainImage = detail?.gallery.find(({ id }) => id === detail.mainImageId);
  const mainImageUrl = detail ? mainImage?.thumbnailUrl : content ? poi?.mainImageUrl : undefined;
  const { person, isLoading: isPersonLoading } = usePerson(selectedPersonId, citySlug, poi?.id);

  return (
    <Drawer
      open={Boolean(selectedPoi)}
      side="right"
      width={width}
      afterLeave={() => {
        if (!selectedPoi) {
          setPoi(undefined);
          setSelectedPerson(undefined);
        }
      }}
    >
      {poi ? (
        <>
          {onResize ? (
            <PanelResizeHandle edge="left" label="Resize details panel" onResize={onResize} />
          ) : null}
          <div key={poi.id} className="h-full overflow-y-auto">
            <div className="absolute top-4 right-4 z-10">
              <DrawerCloseButton onClick={onClose} />
            </div>
            {!selectedPersonId && mainImageUrl && mainImageUrl !== failedMainImageUrl ? (
              <figure>
                <div className="relative aspect-video w-full shrink-0 overflow-hidden bg-zinc-100">
                  <Image
                    src={mainImageUrl}
                    alt={`Main image of ${detail?.name ?? poi.name}`}
                    fill
                    sizes={`(min-width: 768px) ${width ?? 448}px, 100vw`}
                    className="object-cover"
                    onError={() => setFailedMainImageUrl(mainImageUrl)}
                  />
                  {selectedPoi && detail && (
                    <PoiImageGallery
                      key={`${detail.id}-${openRequestId}`}
                      images={detail.gallery}
                      mainImageId={detail.mainImageId}
                      name={detail.name}
                    />
                  )}
                </div>
                {mainImage && (
                  <figcaption className="px-5 py-2 text-xs/5 text-zinc-500">
                    {mainImage.attribution} ·{" "}
                    <a
                      href={mainImage.commonsPageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2"
                    >
                      {mainImage.license} ↗
                    </a>
                  </figcaption>
                )}
              </figure>
            ) : !selectedPersonId && detail ? (
              <div className="flex aspect-video items-center justify-center gap-2 bg-zinc-100 text-sm text-zinc-500">
                <PhotoIcon className="size-6" aria-hidden="true" />
                Image unavailable
              </div>
            ) : null}
            <div className="px-5 py-4 pr-16">
              {selectedPersonId ? (
                <button
                  type="button"
                  onClick={() => setSelectedPerson(undefined)}
                  className="mb-3 inline-flex max-w-full cursor-pointer items-center gap-2 rounded-sm py-2 text-sm text-black/60 hover:text-black focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black/60"
                >
                  <ArrowLeftIcon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">Back to {poi.name}</span>
                </button>
              ) : null}
              <h2 className="font-serif text-2xl/7 tracking-tight text-black">
                {selectedPersonId ? (person?.name ?? "Person") : (detail?.name ?? poi.name)}
              </h2>
              <span aria-hidden="true" className="bg-brand mt-3 block h-1 w-10 rounded-full" />
            </div>
            <div className="px-5 py-4 text-sm/6 text-black/80">
              {excludedByFilters && (
                <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  This place is excluded by your active filters.
                </p>
              )}
              {selectedPersonId ? (
                isPersonLoading ? (
                  <p className="text-black/60">Loading person...</p>
                ) : person ? (
                  <Person person={person} />
                ) : (
                  <p className="text-black/60">This person is unavailable.</p>
                )
              ) : !detail && poi.shortDescription ? (
                <p>{poi.shortDescription}</p>
              ) : null}
              {!selectedPersonId &&
                (isLoading ? (
                  showLoading ? (
                    <p className="mt-4 text-black/60">Loading additional content...</p>
                  ) : null
                ) : content ? (
                  <StoryContent
                    content={content}
                    period={detail ? undefined : poi.period}
                    onOpenPerson={(personId) => setSelectedPerson({ id: personId, openRequestId })}
                  />
                ) : (
                  <p className="mt-4 text-black/60">This place is unavailable.</p>
                ))}
            </div>
          </div>
        </>
      ) : null}
    </Drawer>
  );
};
