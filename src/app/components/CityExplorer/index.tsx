"use client";

import {
  DEFAULT_POI_CATEGORY_DEFINITIONS,
  matchesPoiCategory,
  type PoiCategory,
  type PoiCategoryDefinition,
} from "@/types/PoiCategory";
import { Sidebar } from "./Sidebar";
import { useState } from "react";
import type { Poi } from "@/types/Poi";
import { Map } from "@/app/components/Map";
import { MapZoomControl } from "@/app/components/Map/MapZoomControl";
import { PoiDetailsDrawer } from "@/app/components/PoiDetailsDrawer";

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
        className={`${sidebarOpen ? "absolute inset-y-0 left-0 z-30 shadow-xl" : "hidden"} sm:static sm:z-auto sm:block sm:shadow-none`}
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
        <button
          type="button"
          aria-expanded={sidebarOpen}
          aria-controls="discovery-sidebar"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute bottom-4 left-4 z-10 cursor-pointer rounded-full bg-white px-4 py-3 text-sm font-semibold text-zinc-900 shadow-lg sm:hidden"
        >
          Categories{selectedCategories.length ? ` · ${selectedCategories.length}` : ""}
          {" · "}
          {visiblePois.length} places
        </button>
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
