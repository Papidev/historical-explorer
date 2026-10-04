import { useState, type ReactNode } from "react";
import { SubmitButton } from "../SubmitButton";
import type { PoiCategoryDefinition } from "@/types/PoiCategory";
import type { useTypeMappings } from "./useTypeMappings";

export const CategoryRow = ({
  category,
  model,
  children,
}: {
  category: PoiCategoryDefinition;
  model: ReturnType<typeof useTypeMappings>;
  children?: ReactNode;
}) => {
  const [name, setName] = useState(category.name);
  return (
    <li
      aria-label={`Category ${category.name}`}
      onDragOver={(event) => {
        event.stopPropagation();
        if (
          !model.saving &&
          !category.parent &&
          model.draggedCategoryId &&
          model.draggedCategoryId !== category.id
        ) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }
      }}
      onDrop={(event) => {
        event.stopPropagation();
        event.preventDefault();
        if (
          !model.saving &&
          !category.parent &&
          model.draggedCategoryId &&
          model.draggedCategoryId !== category.id
        )
          model.moveCategory(model.draggedCategoryId, category.id);
      }}
      className={`flex flex-wrap items-center gap-2 rounded-md border-b border-gray-100 py-3 ${model.draggedCategoryId && model.draggedCategoryId !== category.id && !category.parent ? "bg-indigo-50 outline-1 outline-indigo-200" : ""}`}
    >
      <button
        type="button"
        draggable={!model.saving && !model.categories.some((child) => child.parent === category.id)}
        disabled={model.saving || model.categories.some((child) => child.parent === category.id)}
        aria-label={`Drag ${category.name}`}
        title={
          model.categories.some((child) => child.parent === category.id)
            ? "Move child categories to the top level first"
            : "Drag into a parent category"
        }
        onDragStart={(event) => {
          event.stopPropagation();
          event.dataTransfer.setData("text/plain", category.id);
          event.dataTransfer.effectAllowed = "move";
          model.setDraggedCategoryId(category.id);
        }}
        onDragEnd={() => model.setDraggedCategoryId(null)}
        className="cursor-grab rounded px-2 py-1 text-gray-500 hover:bg-gray-100 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-30"
      >
        <span aria-hidden="true">⠿</span>
      </button>
      <label className="min-w-40 flex-1">
        <span className="sr-only">Name for {category.name}</span>
        <input
          disabled={model.saving}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
          value={name}
          maxLength={80}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <button
        aria-label={`Rename ${category.name}`}
        disabled={model.saving || !name.trim() || name.trim() === category.name}
        className="cursor-pointer rounded-md px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40"
        onClick={() => model.saveCategory(category.id, name)}
      >
        Rename<span className="sr-only"> {category.name}</span>
      </button>
      <form action={() => model.deleteCategory(category.id)}>
        <SubmitButton
          idleLabel="Delete"
          pendingLabel="Deleting…"
          tone="danger"
          disabled={model.saving}
          confirmMessage={`Remove ${category.name} from all type rules and POIs? Its child categories will also be deleted.`}
        />
      </form>
      {children}
    </li>
  );
};
