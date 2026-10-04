import { useState } from "react";
import { expandPoiCategorySelection } from "@/types/PoiCategory";
import { CategorySelection } from "./CategorySelection";
import type { useTypeMappings } from "./useTypeMappings";

export const RuleEditor = ({
  model,
  type,
}: {
  model: ReturnType<typeof useTypeMappings>;
  type: ReturnType<typeof useTypeMappings>["types"][number];
}) => {
  const [draft, setDraft] = useState(() =>
    expandPoiCategorySelection(type.categories ?? [], model.categories),
  );
  return (
    <section
      aria-label={`Edit ${type.label}`}
      className="space-y-5 rounded-lg border border-gray-200 bg-white p-5"
    >
      <div>
        <h3 className="text-lg font-semibold text-gray-900">{type.label}</h3>
        <p className="mt-1 text-xs text-gray-500">
          <a
            className="text-indigo-600 hover:underline"
            href={`https://www.wikidata.org/wiki/${type.id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {type.id}
          </a>{" "}
          · {type.status} · {type.origin ?? "Unclassified"} · {type.pois.length} POIs ·{" "}
          {new Set(type.pois.map((poi) => poi.city)).size} cities
        </p>
      </div>
      {type.origin === "manual" && type.categories === undefined && (
        <p className="text-xs text-gray-500">
          Cleared manually. Automatic classification will leave this type unchanged.
        </p>
      )}
      <fieldset disabled={model.saving}>
        <legend className="mb-3 text-sm font-medium text-gray-900">
          Assign one or several categories
        </legend>
        <p className="mb-3 text-xs text-gray-500">
          Selecting a parent includes all its children. Selecting a child also assigns its parent.
        </p>
        <div className="grid items-start gap-2 sm:grid-cols-2">
          {model.categories
            .filter((category) => !category.parent)
            .map((category) => (
              <div key={category.id} className="space-y-2">
                <CategorySelection
                  category={category}
                  draft={draft}
                  definitions={model.categories}
                  onChange={setDraft}
                />
                {model.categories.some((child) => child.parent === category.id) && (
                  <div
                    role="group"
                    aria-label={`Child categories of ${category.name}`}
                    className="ml-4 space-y-2 border-l border-gray-200 pl-3"
                  >
                    {model.categories
                      .filter((child) => child.parent === category.id)
                      .map((child) => (
                        <CategorySelection
                          key={child.id}
                          category={child}
                          draft={draft}
                          definitions={model.categories}
                          onChange={setDraft}
                        />
                      ))}
                  </div>
                )}
              </div>
            ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <button
          disabled={model.saving || !draft.length}
          onClick={() => void model.save(type.id, draft)}
          className="cursor-pointer rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {model.saving ? "Saving…" : "Save categories"}
        </button>
        <button
          disabled={model.saving}
          onClick={() => void model.save(type.id, [])}
          className="cursor-pointer rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Ignore type
        </button>
        <button
          disabled={model.saving}
          onClick={() => void model.save(type.id, null)}
          className="cursor-pointer rounded-md px-3 py-2 text-sm text-amber-800 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Clear rule
        </button>
      </div>
      <p className="text-xs text-gray-500">
        Ignore assigns no categories and resolves the mapping warning. Clear returns the type to
        Unmapped. Changes apply across cities without regenerating Stories.
      </p>
      <details className="border-t border-gray-100 pt-3 text-sm">
        <summary className="cursor-pointer font-medium text-gray-700">
          Affected POIs ({type.pois.length})
        </summary>
        <ul className="mt-2 max-h-64 space-y-1 overflow-auto text-gray-500">
          {type.pois.map((poi) => (
            <li key={`${poi.city}/${poi.id}`}>
              {poi.name} <span className="text-xs text-gray-400">· {poi.city}</span>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
};
