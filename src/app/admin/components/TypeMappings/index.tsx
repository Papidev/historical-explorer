"use client";

import { ListboxSelect } from "@/app/components/ui/ListboxSelect";
import type {
  SaveTypeMapping,
  TypeMappingCatalog,
  CategoryActions,
  ClassifyTypeMappings,
} from "@/types/PoiTypeMapping";
import { useTypeMappings } from "./useTypeMappings";
import type { RefObject } from "react";
import type { AiSelection } from "../../lib/aiModels";
import { CategoryManager } from "./CategoryManager";
import { RuleEditor } from "./RuleEditor";
import { ActionToast } from "../ActionToast";

export const TypeMappings = ({
  catalog,
  saveRule,
  categoryActions,
  classifyRules,
  aiSelectionRef,
}: {
  catalog: TypeMappingCatalog;
  saveRule: SaveTypeMapping;
  categoryActions?: CategoryActions;
  classifyRules?: ClassifyTypeMappings;
  aiSelectionRef?: RefObject<Pick<AiSelection, "mode" | "model">>;
}) => {
  const model = useTypeMappings(catalog, saveRule, categoryActions, classifyRules, aiSelectionRef);
  return (
    <div className="min-h-0 flex-1 overflow-auto pb-5 text-gray-900">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Type mappings</h2>
          <p className="mt-1 text-sm text-gray-500">
            Shared category rules for acquired Wikidata types across all cities.
          </p>
        </div>
        <p className="rounded-md bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
          {model.types.length} types ·{" "}
          {model.types.filter((type) => type.status === "Unmapped").length} unmapped
        </p>
      </header>
      {classifyRules && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <button
            disabled={
              model.saving ||
              !model.types.some((type) => type.categories === undefined && type.origin !== "manual")
            }
            onClick={model.classifyUnmapped}
            className="cursor-pointer rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {model.saving ? "Working…" : "Classify unmapped types"}
          </button>
          <p className="text-xs text-gray-500">
            Uses the selected AI. Matches existing categories first, then creates categories when
            needed.
          </p>
        </div>
      )}
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <label className="min-w-56 flex-1 text-sm font-medium">
          Search types
          <input
            className="mt-2 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 font-normal"
            placeholder="Type label or Q ID"
            value={model.query}
            onChange={(event) => model.setQuery(event.target.value)}
          />
        </label>
        <div className="w-40">
          <ListboxSelect
            label="Rule state"
            value={model.status}
            onChange={model.setStatus}
            options={["All", "Unmapped", "Mapped", ...(model.showIgnored ? ["Ignored"] : [])].map(
              (value) => ({ label: value, value }),
            )}
          />
        </div>
      </div>
      <label className="mb-4 flex cursor-pointer items-center gap-2 text-sm text-gray-600">
        <input
          type="checkbox"
          checked={model.showIgnored}
          onChange={(event) => model.setShowIgnored(event.target.checked)}
          className="size-4 cursor-pointer accent-indigo-600"
        />
        Show ignored types
      </label>
      {model.message && (
        <ActionToast
          toast={{ tone: "success", title: "Changes saved", description: model.message }}
          onDismiss={model.dismissMessage}
        />
      )}
      {model.error && (
        <p role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {model.error}
        </p>
      )}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(240px,1fr)_2fr]">
        <nav
          aria-label="Acquired types"
          className="max-h-[65vh] overflow-auto rounded-lg border border-gray-200 bg-white"
        >
          {model.visibleTypes.length ? (
            model.visibleTypes.map((type) => (
              <button
                key={type.id}
                disabled={model.saving}
                aria-pressed={model.selected?.id === type.id}
                onClick={() => model.setSelectedId(type.id)}
                className="flex w-full cursor-pointer items-start justify-between gap-3 border-b border-gray-100 p-4 text-left hover:bg-gray-50 disabled:cursor-not-allowed aria-pressed:border-l-4 aria-pressed:border-l-indigo-600 aria-pressed:bg-indigo-50"
              >
                <span>
                  <span className="block text-sm font-medium text-gray-900">{type.label}</span>
                  <span className="text-xs text-gray-500">
                    {type.id} · {type.pois.length} POIs
                  </span>
                  {Boolean(type.categories?.length) && (
                    <span className="mt-1 block text-xs text-indigo-700">
                      {type.categories
                        ?.map(
                          (id) =>
                            model.categories.find((category) => category.id === id)?.name ?? id,
                        )
                        .join(", ")}
                    </span>
                  )}
                </span>
                <span
                  className={
                    type.status === "Unmapped" ? "text-xs text-amber-700" : "text-xs text-gray-500"
                  }
                >
                  {type.status}
                </span>
              </button>
            ))
          ) : (
            <p className="p-5 text-sm text-gray-500">No matching types.</p>
          )}
        </nav>
        {model.selected && (
          <RuleEditor
            key={`${model.selected.id}-${JSON.stringify(model.selected.categories)}-${JSON.stringify(model.categories)}`}
            model={model}
            type={model.selected}
          />
        )}
      </div>
      {categoryActions && <CategoryManager model={model} />}
      <details className="mt-5 rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">
        <summary className="cursor-pointer font-medium">
          Missing POI types ({catalog.missingTypes.length})
        </summary>
        <p className="mt-2 text-xs text-gray-500">
          These POIs have no acquired direct types. Mapping gaps do not change Story completeness or
          remove POIs.
        </p>
        <ul className="mt-3 max-h-52 space-y-1 overflow-auto">
          {catalog.missingTypes.map((poi) => (
            <li key={`${poi.city}/${poi.id}`}>
              {poi.name} <span className="text-xs text-gray-400">· {poi.city}</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
};
