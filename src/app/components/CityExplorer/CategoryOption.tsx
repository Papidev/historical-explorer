import { useId } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { MapPinIcon } from "@heroicons/react/24/solid";
import { categoryMarkerColors } from "@/app/components/categoryMarkerColors";
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
  disclosure,
}: {
  category: PoiCategory;
  definitions?: PoiCategoryDefinition[];
  count: number;
  checked: boolean;
  indeterminate?: boolean;
  onToggle: () => void;
  disclosure?: {
    expanded: boolean;
    controls: string;
    label: string;
    onToggle: () => void;
  };
}) => {
  const inputId = useId();
  const definition = definitions.find((definition) => definition.id === category);
  const markerColor = categoryMarkerColors.find(({ category: id }) => id === category);
  const label = definition?.label ?? definition?.name ?? category;
  const content = (
    <>
      <span className={`flex flex-1 items-center gap-1.5 ${disclosure ? "font-semibold" : ""}`}>
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
    </>
  );
  return (
    <div
      className={`flex flex-1 items-center gap-2 ${definition?.parent ? "text-[15px]" : "text-sm"}`}
    >
      <input
        id={inputId}
        type="checkbox"
        aria-label={label}
        aria-describedby={definition?.parent ? `${category}-parent` : undefined}
        checked={checked}
        ref={(input) => {
          if (input) input.indeterminate = indeterminate;
        }}
        onChange={onToggle}
        className="size-4 cursor-pointer accent-yellow-700"
      />
      {disclosure && (
        <span aria-hidden="true" className="relative size-8 shrink-0">
          <MapPinIcon
            className={`size-8 drop-shadow-sm ${markerColor?.pinClass ?? "text-[#3FB1CE]"}`}
          />
          <span
            className={`absolute top-[4px] left-[6px] flex size-5 items-center justify-center rounded-full bg-current ${markerColor?.pinClass ?? "text-[#3FB1CE]"}`}
          >
            {/* Static category SVG shared with MapLibre's generated markers. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={markerColor?.icon ?? "/icons/categories/other.svg"}
              alt=""
              className="size-4"
            />
          </span>
        </span>
      )}
      {disclosure ? (
        <button
          type="button"
          aria-label={disclosure.label}
          aria-expanded={disclosure.expanded}
          aria-controls={disclosure.controls}
          onClick={disclosure.onToggle}
          className="flex min-h-7 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
        >
          {content}
          <span className="flex size-7 shrink-0 items-center justify-center text-zinc-400">
            <ChevronDownIcon
              aria-hidden="true"
              className={`size-4 transition-transform ${disclosure.expanded ? "rotate-180" : ""}`}
            />
          </span>
        </button>
      ) : (
        <label htmlFor={inputId} className="flex flex-1 cursor-pointer items-center gap-2">
          {content}
        </label>
      )}
    </div>
  );
};
