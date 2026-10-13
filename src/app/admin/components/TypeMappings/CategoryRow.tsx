import { useState, type ReactNode } from "react";
import { PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";
import { IconButton } from "@/app/components/ui/IconButton";
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
      className={`flex flex-wrap items-center gap-2 rounded-md border-b border-gray-100 py-3 [&_[role=tooltip]]:right-0 [&_[role=tooltip]]:left-auto [&_[role=tooltip]]:translate-x-0 ${model.draggedCategoryId && model.draggedCategoryId !== category.id && !category.parent ? "bg-indigo-50 outline-1 outline-indigo-200" : ""}`}
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
      <IconButton
        label={`Rename ${category.name}`}
        disabled={model.saving || !name.trim() || name.trim() === category.name}
        tone="primary"
        onClick={() => model.saveCategory(category.id, name)}
      >
        <PencilSquareIcon />
      </IconButton>
      <form action={() => model.deleteCategory(category.id)}>
        <SubmitButton
          idleLabel="Delete"
          pendingLabel="Deleting…"
          icon={<TrashIcon />}
          tone="danger"
          disabled={model.saving}
          confirmMessage={`Remove ${category.name} from all type rules and POIs? Its child categories will also be deleted.`}
        />
      </form>
      {children}
    </li>
  );
};
