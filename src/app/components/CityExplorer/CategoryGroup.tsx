import { useId, useState } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import type { Poi } from "@/types/Poi";
import { POI_SUBCATEGORIES, matchesPoiCategory, type PoiCategory } from "@/types/PoiCategory";
import { CategoryOption } from "./CategoryOption";

export const CategoryGroup = ({
  category,
  pois,
  selectedCategories,
  onToggleCategory,
}: {
  category: PoiCategory;
  pois: Poi[];
  selectedCategories: PoiCategory[];
  onToggleCategory: (category: PoiCategory) => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const subcategoriesId = useId();
  const count = pois.filter((poi) => matchesPoiCategory(poi.categories, category)).length;
  const children = POI_SUBCATEGORIES.filter(({ parent }) => parent === category)
    .map(({ name }) => ({
      name,
      count: pois.filter((poi) => matchesPoiCategory(poi.categories, name)).length,
    }))
    .filter(({ count }) => count > 0);
  if (!count) return null;
  return (
    <div>
      <div className="flex items-center gap-2">
        <CategoryOption
          category={category}
          count={count}
          checked={selectedCategories.includes(category)}
          onToggle={() => onToggleCategory(category)}
        />
        {children.length > 0 ? (
          <button
            type="button"
            aria-label={`${expanded ? "Hide" : "Show"} subcategories for ${category}`}
            aria-expanded={expanded}
            aria-controls={subcategoriesId}
            onClick={() => setExpanded(!expanded)}
            className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700"
          >
            <ChevronDownIcon
              aria-hidden="true"
              className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </button>
        ) : (
          <span aria-hidden="true" className="w-7 shrink-0" />
        )}
      </div>
      {children.length > 0 && (
        <div
          id={subcategoriesId}
          hidden={!expanded}
          className="mt-2 ml-5 space-y-2 border-l border-zinc-200 pr-9 pl-3"
        >
          {children.map(({ name, count }) => (
            <CategoryOption
              key={name}
              category={name}
              count={count}
              checked={selectedCategories.includes(name)}
              onToggle={() => onToggleCategory(name)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
