import { useId, useState } from "react";
import { ArrowUpRightIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import type { Poi } from "@/types/Poi";
import {
  DEFAULT_POI_CATEGORY_DEFINITIONS,
  type PoiCategory,
  type PoiCategoryDefinition,
} from "@/types/PoiCategory";
import { DrawerCloseButton } from "@/app/components/ui/DrawerCloseButton";
import { CategoryGroup } from "./CategoryGroup";
import { Search } from "./Search";

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
  onSearchPoi,
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
  onSearchPoi: (poi: Poi) => void;
  onClose: () => void;
}) => {
  const [expanded, setExpanded] = useState(true);
  const categoriesId = useId();
  return (
    <aside
      aria-label="Discover places"
      className="border-brand/70 flex h-full w-full shrink-0 flex-col overflow-hidden border-r bg-zinc-50 text-zinc-900"
    >
      <div className="border-brand/70 flex shrink-0 items-start justify-between gap-2 border-b px-4 py-3">
        <div>
          <h2 className="font-serif text-2xl/7 tracking-tight">Explore the city</h2>
          <span aria-hidden="true" className="bg-brand mt-3 block h-1 w-10 rounded-full" />
        </div>
        <DrawerCloseButton label="Close filters" onClick={onClose} transparent />
      </div>
      <div className="shrink-0 px-4 pt-3 pb-2">
        <Search pois={pois} onSelect={onSearchPoi} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-2 pb-4">
        <fieldset className="space-y-2 rounded-xl border border-zinc-200 bg-white px-3 py-1">
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
              className="size-4 cursor-pointer accent-yellow-700"
            />
            <button
              type="button"
              aria-label={`${expanded ? "Hide" : "Show"} categories`}
              aria-expanded={expanded}
              aria-controls={categoriesId}
              onClick={() => setExpanded(!expanded)}
              className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded text-left text-sm font-semibold transition-colors hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
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
              .sort(
                (a, b) =>
                  Number(a.id === "Other places") - Number(b.id === "Other places") ||
                  (a.label ?? a.name).localeCompare(b.label ?? b.name, "en"),
              )
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
        <p role="status" className="mt-6 px-1 text-xs font-semibold tracking-wide text-zinc-500">
          {visiblePois.length} {visiblePois.length === 1 ? "place" : "places"} to explore
        </p>
        {!visiblePois.length && (
          <p className="mt-2 text-sm text-zinc-500">
            {selectedCategories.length
              ? "No places match these categories. Try another category."
              : "Select a category to explore places."}
          </p>
        )}
        <ul className="mt-3 space-y-2">
          {visiblePois.map((poi) => (
            <li key={poi.id}>
              <button
                type="button"
                aria-label={poi.name}
                aria-pressed={selectedPoiId === poi.id}
                onClick={() => onOpenPoi(poi.id)}
                className={`group flex w-full cursor-pointer items-center gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-800 ${selectedPoiId === poi.id ? "border-yellow-300 bg-yellow-50" : "border-zinc-200/80 bg-white hover:border-yellow-300"}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-lg leading-snug font-medium">{poi.name}</span>
                  <span className="mt-1.5 block text-xs/5 text-zinc-500">
                    {poi.categories
                      ?.map(
                        (id) =>
                          categoryDefinitions.find((category) => category.id === id)?.name ?? id,
                      )
                      .sort((a, b) => a.localeCompare(b, "en"))
                      .join(" · ") || "Uncategorized"}
                  </span>
                </span>
                <ArrowUpRightIcon
                  aria-hidden="true"
                  className={`size-4 shrink-0 ${selectedPoiId === poi.id ? "text-yellow-800" : "text-zinc-400 group-hover:text-zinc-800"}`}
                />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
};
