"use client";

import {
  DEFAULT_POI_CATEGORY_DEFINITIONS,
  matchesPoiCategory,
  type PoiCategory,
  type PoiCategoryDefinition,
} from "@/types/PoiCategory";
import { Sidebar } from "./Sidebar";
import { useFilterSwipe } from "./useFilterSwipe";
import { useState } from "react";
import type { Poi } from "@/types/Poi";
import { Map } from "@/app/components/Map";
import { MapZoomControl } from "@/app/components/Map/MapZoomControl";
import { PoiDetailsDrawer } from "@/app/components/PoiDetailsDrawer";
import { ChevronRightIcon } from "@heroicons/react/24/outline";

type Props = {
  citySlug: string;
  coordinates: [number, number];
  initialZoom: number;
  initialSelectedPoiId?: string | null;
  pois: Poi[];
  categoryDefinitions?: PoiCategoryDefinition[];
};

export const CityExplorer = ({
  citySlug,
  coordinates,
  initialZoom,
  initialSelectedPoiId = null,
  pois,
  categoryDefinitions = DEFAULT_POI_CATEGORY_DEFINITIONS,
}: Props) => {
  const availableCategories = categoryDefinitions
    .map(({ id }) => id)
    .filter((category) =>
      pois.some((poi) => matchesPoiCategory(poi.categories, category, categoryDefinitions)),
    );
  const [categorySelection, setSelectedCategories] = useState<PoiCategory[] | null>(null);
  const selectedCategories = (categorySelection ?? availableCategories).filter((id) =>
    categoryDefinitions.some((category) => category.id === id),
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const openFiltersSwipe = useFilterSwipe("right", () => setSidebarOpen(true));
  const closeFiltersSwipe = useFilterSwipe("left", () => setSidebarOpen(false));
  const [zoom, setZoom] = useState(initialZoom);
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(initialSelectedPoiId);
  const [openRequestId, setOpenRequestId] = useState(0);
  const visiblePois = pois.filter(
    (poi) =>
      !selectedCategories.length ||
      availableCategories.every((category) => selectedCategories.includes(category)) ||
      selectedCategories.some((category) =>
        matchesPoiCategory(poi.categories, category, categoryDefinitions),
      ),
  );
  const selectedPoi = selectedPoiId
    ? visiblePois.find((poi) => poi.id === selectedPoiId)
    : undefined;
  const updateCategories = (next: PoiCategory[]) => {
    setSelectedCategories(next);
    if (
      selectedPoi &&
      next.length &&
      !availableCategories.every((category) => next.includes(category)) &&
      !next.some((category) =>
        matchesPoiCategory(selectedPoi.categories, category, categoryDefinitions),
      )
    ) {
      setSelectedPoiId(null);
    }
  };
  const openPoi = (poiId: string) => {
    setSelectedPoiId(poiId);
    setOpenRequestId((current) => current + 1);
    setSidebarOpen(false);
  };

  return (
    <div className="relative flex h-full w-full overflow-hidden">
      <div
        id="discovery-sidebar"
        {...closeFiltersSwipe}
        className={`fixed inset-0 z-30 h-dvh w-full touch-pan-y transition-transform duration-200 motion-reduce:transition-none ${sidebarOpen ? "visible translate-x-0 shadow-xl" : "invisible -translate-x-full"} lg:visible lg:static lg:z-auto lg:h-full lg:w-72 lg:translate-x-0 lg:shadow-none`}
      >
        <Sidebar
          citySlug={citySlug}
          categoryDefinitions={categoryDefinitions}
          pois={pois}
          visiblePois={visiblePois}
          selectedCategories={selectedCategories}
          selectedPoiId={selectedPoiId}
          onToggleCategory={(category) => {
            const children: PoiCategory[] = categoryDefinitions
              .filter(({ parent }) => parent === category)
              .map(({ id }) => id);
            updateCategories(
              selectedCategories.includes(category)
                ? selectedCategories.filter(
                    (selected) =>
                      selected !== category &&
                      !children.includes(selected) &&
                      selected !==
                        categoryDefinitions.find((definition) => definition.id === category)
                          ?.parent,
                  )
                : [...new Set([...selectedCategories, category, ...children])],
            );
          }}
          onClear={() => updateCategories([])}
          onOpenPoi={openPoi}
          onClose={() => setSidebarOpen(false)}
        />
      </div>
      <div className="relative min-w-0 flex-1 overflow-hidden">
        {!sidebarOpen && !selectedPoi && (
          <button
            type="button"
            aria-label="Open filters"
            aria-expanded={sidebarOpen}
            aria-controls="discovery-sidebar"
            {...openFiltersSwipe}
            onClick={() => setSidebarOpen(true)}
            className="group absolute inset-y-0 left-0 z-10 w-6 cursor-pointer touch-pan-y focus-visible:outline-none lg:hidden"
          >
            <span
              aria-hidden="true"
              className="absolute top-1/2 left-0 flex w-6 -translate-y-1/2 flex-col items-center gap-2 rounded-r-lg border border-l-0 border-zinc-200 bg-white/95 py-3 text-zinc-600 shadow-md group-hover:bg-rose-50 group-focus-visible:ring-2 group-focus-visible:ring-rose-600"
            >
              <ChevronRightIcon className="size-4" />
              <span className="text-xs font-semibold [writing-mode:vertical-rl]">Filters</span>
            </span>
          </button>
        )}
        <MapZoomControl zoom={zoom} onChange={setZoom} />
        <Map
          coordinates={coordinates}
          zoom={zoom}
          pois={visiblePois}
          onZoomChange={setZoom}
          onOpenPoiDetails={openPoi}
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
    </div>
  );
};
