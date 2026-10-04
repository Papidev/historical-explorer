import { useState } from "react";
import { CategoryRow } from "./CategoryRow";
import type { useTypeMappings } from "./useTypeMappings";

export const CategoryManager = ({ model }: { model: ReturnType<typeof useTypeMappings> }) => {
  const [name, setName] = useState("");
  return (
    <details className="mt-5 rounded-lg border border-gray-200 bg-white p-4">
      <summary className="cursor-pointer text-sm font-semibold">
        Manage categories ({model.categories.length})
      </summary>
      <p className="mt-2 text-xs text-gray-500">
        Drag a category onto a parent to move it inside. Drop it on Top level to remove its parent.
        Categories with children must stay at the top level. Names are shared across cities.
        Renaming preserves assignments; deleting removes the category and its children from all
        rules and POIs. Types with no remaining categories become Unmapped. Deleted names will not
        be recreated by the AI.
      </p>
      <div
        role="group"
        aria-label="Top-level category drop area"
        onDragOver={(event) => {
          if (!model.saving && model.draggedCategoryId) {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          if (!model.saving && model.draggedCategoryId)
            model.moveCategory(model.draggedCategoryId, null);
        }}
        className={`mt-3 rounded-md border border-dashed p-3 text-sm ${model.draggedCategoryId ? "border-indigo-400 bg-indigo-50 text-indigo-800" : "border-gray-300 text-gray-500"}`}
      >
        Top level · drop here to remove a parent
      </div>
      <ul className="mt-3 max-h-80 overflow-auto">
        {model.categories
          .filter((category) => !category.parent)
          .map((category) => (
            <CategoryRow key={`${category.id}-${category.name}`} category={category} model={model}>
              {model.categories.some((child) => child.parent === category.id) && (
                <ul
                  aria-label={`Child categories of ${category.name}`}
                  className="ml-4 w-full border-l border-gray-200 pl-3"
                >
                  {model.categories
                    .filter((child) => child.parent === category.id)
                    .map((child) => (
                      <CategoryRow
                        key={`${child.id}-${child.name}`}
                        category={child}
                        model={model}
                      />
                    ))}
                </ul>
              )}
            </CategoryRow>
          ))}
      </ul>
      <form
        className="mt-4 flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          model.saveCategory(null, name);
        }}
      >
        <label className="min-w-48 flex-1 text-sm font-medium">
          New category
          <input
            value={name}
            maxLength={80}
            disabled={model.saving}
            onChange={(event) => setName(event.target.value)}
            placeholder="Singular English name"
            className="mt-2 block w-full rounded-md border border-gray-300 px-3 py-2 font-normal"
          />
        </label>
        <button
          disabled={model.saving || !name.trim()}
          className="cursor-pointer rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Add category
        </button>
      </form>
    </details>
  );
};
