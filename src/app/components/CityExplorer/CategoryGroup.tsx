import { useId, useState } from "react";
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
    .sort((a, b) => (a.label ?? a.name).localeCompare(b.label ?? b.name, "en"))
    .map(({ id }) => ({
      name: id,
      count: pois.filter((poi) => matchesPoiCategory(poi.categories, id, definitions)).length,
    }))
    .filter(({ count }) => count > 0);
  if (!count) return null;
  return (
    <div className={children.length ? "-mx-2 rounded-lg bg-zinc-50 px-2 py-1.5" : undefined}>
      <div className="flex items-center gap-2">
        <CategoryOption
          category={category}
          definitions={definitions}
          count={count}
          checked={selectedCategories.includes(category)}
          indeterminate={
            !selectedCategories.includes(category) &&
            children.some(({ name }) => selectedCategories.includes(name))
          }
          onToggle={() => onToggleCategory(category)}
          disclosure={
            children.length
              ? {
                  expanded,
                  controls: subcategoriesId,
                  label: `${expanded ? "Hide" : "Show"} subcategories for ${definitions.find((definition) => definition.id === category)?.name ?? category}`,
                  onToggle: () => setExpanded(!expanded),
                }
              : undefined
          }
        />
        {!children.length && <span aria-hidden="true" className="w-7 shrink-0" />}
      </div>
      {children.length > 0 && (
        <div
          id={subcategoriesId}
          hidden={!expanded}
          className="mt-1 ml-5 space-y-2 border-l border-zinc-200 pr-9 pl-3"
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
