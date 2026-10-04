import { useId, useState } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import type { Poi } from "@/types/Poi";
import {
  DEFAULT_POI_CATEGORY_DEFINITIONS,
  matchesPoiCategory,
  type PoiCategory,
  type PoiCategoryDefinition,
} from "@/types/PoiCategory";
import { CategoryOption } from "./CategoryOption";

export const CategoryGroup = ({
  category,
  definitions = DEFAULT_POI_CATEGORY_DEFINITIONS,
  pois,
  selectedCategories,
  onToggleCategory,
}: {
  category: PoiCategory;
  definitions?: PoiCategoryDefinition[];
  pois: Poi[];
  selectedCategories: PoiCategory[];
  onToggleCategory: (category: PoiCategory) => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const subcategoriesId = useId();
  const count = pois.filter((poi) =>
    matchesPoiCategory(poi.categories, category, definitions),
  ).length;
  const children = definitions
    .filter(({ parent }) => parent === category)
    .map(({ id }) => ({
      name: id,
      count: pois.filter((poi) => matchesPoiCategory(poi.categories, id, definitions)).length,
    }))
    .filter(({ count }) => count > 0);
  if (!count) return null;
  return (
    <div>
      <div className="flex items-center gap-2">
        <CategoryOption
          category={category}
          definitions={definitions}
          count={count}
          checked={selectedCategories.includes(category)}
          onToggle={() => onToggleCategory(category)}
        />
        {children.length > 0 ? (
          <button
            type="button"
            aria-label={`${expanded ? "Hide" : "Show"} subcategories for ${definitions.find((definition) => definition.id === category)?.name ?? category}`}
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
              definitions={definitions}
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
