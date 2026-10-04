import {
  DEFAULT_POI_CATEGORY_DEFINITIONS,
  type PoiCategory,
  type PoiCategoryDefinition,
} from "@/types/PoiCategory";

export const CategoryOption = ({
  category,
  definitions = DEFAULT_POI_CATEGORY_DEFINITIONS,
  count,
  checked,
  onToggle,
}: {
  category: PoiCategory;
  definitions?: PoiCategoryDefinition[];
  count: number;
  checked: boolean;
  onToggle: () => void;
}) => {
  const definition = definitions.find((definition) => definition.id === category);
  const label = definition?.label ?? definition?.name ?? category;
  return (
    <label className="flex flex-1 cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        aria-label={label}
        aria-describedby={definition?.parent ? `${category}-parent` : undefined}
        checked={checked}
        onChange={onToggle}
        className="size-4 cursor-pointer accent-rose-700"
      />
      <span className="flex-1">{label}</span>
      {definition?.parent && (
        <span id={`${category}-parent`} className="sr-only">
          Subcategory of{" "}
          {definitions.find((parent) => parent.id === definition.parent)?.name ?? definition.parent}
        </span>
      )}
      <span
        aria-hidden="true"
        className="min-w-5 shrink-0 text-right text-xs text-zinc-400 tabular-nums"
      >
        {count}
      </span>
    </label>
  );
};
