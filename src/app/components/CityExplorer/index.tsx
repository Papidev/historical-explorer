"use client";

import {
  DEFAULT_POI_CATEGORY_DEFINITIONS,
  matchesPoiCategory,
  type PoiCategory,
  type PoiCategoryDefinition,
} from "@/types/PoiCategory";
import { Sidebar } from "./Sidebar";
import { useFilterSwipe } from "./useFilterSwipe";
import { useDesktopLayout } from "./useDesktopLayout";
import { useState } from "react";
import { PanelResizeHandle } from "@/app/components/ui/PanelResizeHandle";
import { DrawerTab } from "@/app/components/ui/DrawerTab";
import { Drawer } from "@/app/components/ui/Drawer";
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
  const [sidebarOpen, setSidebarOpen] = useState<boolean | null>(null);
  const isDesktop = useDesktopLayout();
  const sidebarVisible = sidebarOpen ?? isDesktop;
  const [sidebarWidth, setSidebarWidth] = useState<number>();
  const [detailsWidth, setDetailsWidth] = useState<number>();
  const openFiltersSwipe = useFilterSwipe("right", () => setSidebarOpen(true));
  const closeFiltersSwipe = useFilterSwipe("left", () => setSidebarOpen(false));
  const [zoom, setZoom] = useState(initialZoom);
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(initialSelectedPoiId);
  const [openRequestId, setOpenRequestId] = useState(0);
  const visiblePois = pois.filter(
    (poi) =>
      selectedCategories.length > 0 &&
      (availableCategories.every((category) => selectedCategories.includes(category)) ||
        selectedCategories.some((category) =>
          matchesPoiCategory(poi.categories, category, categoryDefinitions),
        )),
  );
  const selectedPoi = selectedPoiId
    ? visiblePois.find((poi) => poi.id === selectedPoiId)
    : undefined;
  const updateCategories = (next: PoiCategory[]) => {
    setSelectedCategories(next);
    if (
      selectedPoi &&
      (!next.length ||
        (!availableCategories.every((category) => next.includes(category)) &&
          !next.some((category) =>
            matchesPoiCategory(selectedPoi.categories, category, categoryDefinitions),
          )))
    ) {
      setSelectedPoiId(null);
    }
  };
  const openPoi = (poiId: string) => {
    setSelectedPoiId(poiId);
    setOpenRequestId((current) => current + 1);
    setSidebarOpen((current) => (current === false ? false : null));
  };

  return (
    <div data-panel-container className="relative flex h-full w-full overflow-hidden">
      <Drawer
        id="discovery-sidebar"
        open={sidebarVisible}
        side="left"
        width={sidebarWidth}
        {...closeFiltersSwipe}
        className="z-30 touch-pan-y lg:w-[var(--panel-width,18rem)]"
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
        <PanelResizeHandle edge="right" label="Resize filters panel" onResize={setSidebarWidth} />
      </Drawer>
      <div data-panel-container className="relative min-w-0 flex-1 overflow-hidden">
        {!sidebarVisible && (
          <DrawerTab
            label="Filters"
            aria-label="Open filters"
            aria-expanded={false}
            aria-controls="discovery-sidebar"
            {...openFiltersSwipe}
            onClick={() => setSidebarOpen(true)}
            className={selectedPoi ? "hidden md:block" : undefined}
          />
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
          citySlug={citySlug}
          openRequestId={openRequestId}
          poi={selectedPoi}
          width={detailsWidth}
          onResize={setDetailsWidth}
          onClose={() => setSelectedPoiId(null)}
        />
      </div>
    </div>
  );
};
