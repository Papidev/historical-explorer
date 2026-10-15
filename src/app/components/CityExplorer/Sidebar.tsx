import { useId, useState } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import type { Poi } from "@/types/Poi";
import {
  DEFAULT_POI_CATEGORY_DEFINITIONS,
  type PoiCategory,
  type PoiCategoryDefinition,
} from "@/types/PoiCategory";
import { DrawerCloseButton } from "@/app/components/ui/DrawerCloseButton";
import { CategoryGroup } from "./CategoryGroup";

export const Sidebar = ({
  categoryDefinitions = DEFAULT_POI_CATEGORY_DEFINITIONS,
  pois,
  visiblePois,
  selectedCategories,
  availableCategories,
  allCategoriesSelected,
  selectedPoiId,
  onToggleCategory,
  onToggleAll,
  onOpenPoi,
  onClose,
}: {
  categoryDefinitions?: PoiCategoryDefinition[];
  pois: Poi[];
  visiblePois: Poi[];
  selectedCategories: PoiCategory[];
  availableCategories: PoiCategory[];
  allCategoriesSelected: boolean;
  selectedPoiId: string | null;
  onToggleCategory: (category: PoiCategory) => void;
  onToggleAll: () => void;
  onOpenPoi: (poiId: string) => void;
  onClose: () => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const categoriesId = useId();
  return (
    <aside
      aria-label="Discover places"
      className="flex h-full w-full shrink-0 flex-col overflow-hidden border-r border-zinc-200 bg-white text-zinc-900"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-100 bg-white px-4 py-2">
        <h2 className="text-lg font-semibold">Filters</h2>
        <DrawerCloseButton label="Close filters" onClick={onClose} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <fieldset className="space-y-2">
          <legend className="sr-only">Category filters</legend>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              aria-label="All categories"
              checked={allCategoriesSelected}
              aria-describedby={`${categoriesId}-selection`}
              ref={(input) => {
                if (input)
                  input.indeterminate = !allCategoriesSelected && selectedCategories.length > 0;
              }}
              onChange={() => {
                if (allCategoriesSelected) setExpanded(true);
                onToggleAll();
              }}
              className="size-4 cursor-pointer accent-rose-700"
            />
            <button
              type="button"
              aria-label={`${expanded ? "Hide" : "Show"} categories`}
              aria-expanded={expanded}
              aria-controls={categoriesId}
              onClick={() => setExpanded(!expanded)}
              className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded text-left text-sm font-semibold transition-colors hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700"
            >
              <span className="flex-1">All categories</span>
              <span
                id={`${categoriesId}-selection`}
                className="shrink-0 text-xs font-normal text-zinc-500 tabular-nums"
              >
                {allCategoriesSelected
                  ? "All"
                  : !selectedCategories.length
                    ? "None"
                    : `${
                        selectedCategories.filter(
                          (category) =>
                            availableCategories.includes(category) &&
                            !categoryDefinitions.some(
                              (definition) =>
                                definition.parent === category &&
                                availableCategories.includes(definition.id),
                            ),
                        ).length
                      } selected`}
              </span>
              <span className="flex size-7 shrink-0 items-center justify-center text-zinc-400">
                <ChevronDownIcon
                  aria-hidden="true"
                  className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`}
                />
              </span>
            </button>
          </div>
          <div
            id={categoriesId}
            hidden={!expanded}
            className="ml-5 space-y-2 border-l border-zinc-200 pl-3"
          >
            {categoryDefinitions
              .filter((category) => !category.parent)
              .sort((a, b) => (a.label ?? a.name).localeCompare(b.label ?? b.name, "en"))
              .map((category) => (
                <CategoryGroup
                  key={category.id}
                  category={category.id}
                  definitions={categoryDefinitions}
                  pois={pois}
                  selectedCategories={selectedCategories}
                  onToggleCategory={onToggleCategory}
                />
              ))}
          </div>
        </fieldset>
        <p role="status" className="mt-6 border-t border-zinc-200 pt-4 text-sm font-semibold">
          {visiblePois.length} {visiblePois.length === 1 ? "place" : "places"} to explore
        </p>
        {!visiblePois.length && (
          <p className="mt-2 text-sm text-zinc-500">
            {selectedCategories.length
              ? "No places match these categories. Try another category."
              : "Select a category to explore places."}
          </p>
        )}
        <ul className="mt-2 space-y-1">
          {visiblePois.map((poi) => (
            <li key={poi.id}>
              <button
                type="button"
                aria-label={poi.name}
                aria-pressed={selectedPoiId === poi.id}
                onClick={() => onOpenPoi(poi.id)}
                className={`block w-full cursor-pointer rounded-lg px-2 py-2 text-left text-sm hover:bg-rose-50 ${selectedPoiId === poi.id ? "bg-rose-50 ring-1 ring-rose-200" : ""}`}
              >
                <span className="font-medium">{poi.name}</span>
                <span className="mt-1 block text-xs text-zinc-500">
                  {poi.categories
                    ?.map(
                      (id) =>
                        categoryDefinitions.find((category) => category.id === id)?.name ?? id,
                    )
                    .sort((a, b) => a.localeCompare(b, "en"))
                    .join(" · ") || "Uncategorized"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
};
