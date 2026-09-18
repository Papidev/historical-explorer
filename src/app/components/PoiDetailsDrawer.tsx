"use client";

import { useState } from "react";
import { ArrowLeftIcon, XMarkIcon } from "@heroicons/react/24/outline";
import type { Poi } from "@/types/Poi";
import { StoryContent } from "@/app/components/StoryContent";
import { IconButton } from "@/app/components/ui/IconButton";
import { usePoiStoryContent } from "@/app/components/usePoiStoryContent";
import { Person } from "@/app/components/Person";
import { usePerson } from "@/app/components/usePerson";

export const PoiDetailsDrawer = ({
  citySlug,
  onClose,
  openRequestId = 0,
  poi,
}: {
  citySlug: string;
  onClose: () => void;
  openRequestId?: number;
  poi?: Poi;
}) => {
  const [failedMainImageUrl, setFailedMainImageUrl] = useState<string | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<{
    id: string;
    openRequestId: number;
  }>();
  const selectedPersonId =
    selectedPerson?.openRequestId === openRequestId ? selectedPerson.id : undefined;
  const { content, isLoading } = usePoiStoryContent({ citySlug, poiId: poi?.id });
  const { person, isLoading: isPersonLoading } = usePerson(selectedPersonId);

  return (
    <aside
      className={`absolute top-0 right-0 z-20 h-full w-full max-w-md border-l border-black/10 bg-white shadow-2xl transition-transform duration-300 ${
        poi ? "translate-x-0" : "translate-x-full"
      }`}
      aria-hidden={!poi}
    >
      {poi ? (
        <div className="flex h-full flex-col">
          <div className="absolute top-4 right-4 z-10">
            <IconButton
              label="Close"
              size="large"
              className="bg-white/90 shadow-md backdrop-blur hover:bg-white"
              onClick={() => {
                setSelectedPerson(undefined);
                onClose();
              }}
            >
              <XMarkIcon aria-hidden="true" />
            </IconButton>
          </div>
          {!selectedPersonId && poi.mainImageUrl && poi.mainImageUrl !== failedMainImageUrl ? (
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
            {selectedPersonId ? (
              <button
                type="button"
                onClick={() => setSelectedPerson(undefined)}
                className="mb-3 inline-flex max-w-full cursor-pointer items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-semibold shadow-md ring-1 ring-black/5 hover:bg-neutral-50"
              >
                <ArrowLeftIcon className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">Back to {poi.name}</span>
              </button>
            ) : null}
            <h2 className="text-2xl leading-tight font-semibold text-black">
              {selectedPersonId ? (person?.name ?? "Person") : poi.name}
            </h2>
          </div>
          <div className="overflow-y-auto px-5 py-4 text-sm leading-6 text-black/80">
            {selectedPersonId ? (
              isPersonLoading ? (
                <p className="text-black/60">Loading person...</p>
              ) : person ? (
                <Person person={person} />
              ) : (
                <p className="text-black/60">This person is unavailable.</p>
              )
            ) : poi.shortDescription ? <p>{poi.shortDescription}</p> : null}
            {!selectedPersonId &&
              (isLoading ? (
                <p className="mt-4 text-black/60">Loading additional content...</p>
              ) : content ? (
                <StoryContent
                  content={content}
                  period={poi.period}
                  address={poi.address}
                  onOpenPerson={(personId) =>
                    setSelectedPerson({ id: personId, openRequestId })
                  }
                />
              ) : (
                <p className="mt-4 text-black/60">
                  No additional content is available for this point.
                </p>
              ))}
          </div>
        </div>
      ) : null}
    </aside>
  );
};
