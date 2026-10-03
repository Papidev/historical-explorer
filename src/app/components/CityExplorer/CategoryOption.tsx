import { POI_CATEGORY_LABELS, POI_CATEGORY_PARENTS, type PoiCategory } from "@/types/PoiCategory";

export const CategoryOption = ({
  category,
  count,
  checked,
  onToggle,
}: {
  category: PoiCategory;
  count: number;
  checked: boolean;
  onToggle: () => void;
}) => (
  <label className="flex flex-1 cursor-pointer items-center gap-2 text-sm">
    <input
      type="checkbox"
      aria-label={POI_CATEGORY_LABELS[category] ?? category}
      aria-describedby={POI_CATEGORY_PARENTS[category] ? `${category}-parent` : undefined}
      checked={checked}
      onChange={onToggle}
      className="size-4 cursor-pointer accent-rose-700"
    />
    <span className="flex-1">{POI_CATEGORY_LABELS[category] ?? category}</span>
    {POI_CATEGORY_PARENTS[category] && (
      <span id={`${category}-parent`} className="sr-only">
        Subcategory of {POI_CATEGORY_PARENTS[category]}
      </span>
    )}
    <span aria-hidden="true" className="text-xs text-zinc-400">
      {count}
    </span>
  </label>
);
