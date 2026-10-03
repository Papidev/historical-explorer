import type { Poi } from "@/types/Poi";
import { POI_TOP_LEVEL_CATEGORIES, type PoiCategory } from "@/types/PoiCategory";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { CategoryGroup } from "./CategoryGroup";

export const Sidebar = ({
  citySlug,
  pois,
  visiblePois,
  selectedCategories,
  selectedPoiId,
  onToggleCategory,
  onClear,
  onOpenPoi,
  onClose,
}: {
  citySlug: string;
  pois: Poi[];
  visiblePois: Poi[];
  selectedCategories: PoiCategory[];
  selectedPoiId: string | null;
  onToggleCategory: (category: PoiCategory) => void;
  onClear: () => void;
  onOpenPoi: (poiId: string) => void;
  onClose: () => void;
}) => (
  <aside
    aria-label="Discover places"
    className="flex h-full w-72 max-w-[calc(100vw-3rem)] shrink-0 flex-col overflow-y-auto border-r border-zinc-200 bg-white p-4 text-zinc-900"
  >
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-lg font-semibold">
        Discover {citySlug.charAt(0).toUpperCase() + citySlug.slice(1)}
      </h2>
      <button
        type="button"
        aria-label="Close filters"
        onClick={onClose}
        className="cursor-pointer rounded-md p-2 hover:bg-zinc-100 sm:hidden"
      >
        <XMarkIcon aria-hidden="true" className="size-5" />
      </button>
    </div>
    <p className="mt-1 text-xs text-zinc-500">Choose any categories that interest you.</p>
    <fieldset className="mt-4 space-y-2">
      <legend className="sr-only">Category filters</legend>
      {POI_TOP_LEVEL_CATEGORIES.map((category) => (
        <CategoryGroup
          key={category}
          category={category}
          pois={pois}
          selectedCategories={selectedCategories}
          onToggleCategory={onToggleCategory}
        />
      ))}
    </fieldset>
    <button
      type="button"
      onClick={onClear}
      disabled={!selectedCategories.length}
      className="mt-4 cursor-pointer text-left text-sm text-rose-700 underline disabled:cursor-not-allowed disabled:text-zinc-400"
    >
      Clear categories
    </button>
    <p role="status" className="mt-6 border-t border-zinc-200 pt-4 text-sm font-semibold">
      {visiblePois.length} {visiblePois.length === 1 ? "place" : "places"} to explore
    </p>
    {!visiblePois.length && (
      <p className="mt-2 text-sm text-zinc-500">
        No places match these categories. Try another category or clear your selection.
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
              {poi.categories?.join(" · ") || "Uncategorized"}
            </span>
          </button>
        </li>
      ))}
    </ul>
  </aside>
);
