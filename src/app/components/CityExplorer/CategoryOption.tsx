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
  indeterminate = false,
  onToggle,
}: {
  category: PoiCategory;
  definitions?: PoiCategoryDefinition[];
  count: number;
  checked: boolean;
  indeterminate?: boolean;
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
        ref={(input) => {
          if (input) input.indeterminate = indeterminate;
        }}
        onChange={onToggle}
        className={`size-4 cursor-pointer ${
          category === "Churches & cathedrals" || definition?.parent === "Churches & cathedrals"
            ? "accent-yellow-400"
            : "accent-rose-700"
        }`}
      />
      <span
        className={`flex flex-1 items-center gap-2 ${
          category === "Churches & cathedrals" ? "font-semibold" : ""
        }`}
      >
        {category === "Churches & cathedrals" && (
          <span
            aria-hidden="true"
            className="size-3.5 shrink-0 rounded-full border border-yellow-900 bg-yellow-400"
          />
        )}
        {label}
      </span>
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
