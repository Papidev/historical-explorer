import { useState, useTransition, type RefObject } from "react";
import type {
  SaveTypeMapping,
  TypeMappingCatalog,
  CategoryActions,
  ClassifyTypeMappings,
} from "@/types/PoiTypeMapping";
import { DEFAULT_POI_CATEGORY_DEFINITIONS, type PoiCategory } from "@/types/PoiCategory";
import type { AiSelection } from "../../lib/aiModels";

export const useTypeMappings = (
  catalog: TypeMappingCatalog,
  saveRule: SaveTypeMapping,
  categoryActions?: CategoryActions,
  classifyRules?: ClassifyTypeMappings,
  aiSelectionRef?: RefObject<Pick<AiSelection, "mode" | "model">>,
) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [draggedCategoryId, setDraggedCategoryId] = useState<string | null>(null);
  const [showIgnored, setShowIgnored] = useState(false);
  const [saving, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const types = catalog.types.map((type) => ({
    ...type,
    status:
      type.categories === undefined ? "Unmapped" : type.categories.length ? "Mapped" : "Ignored",
  }));
  const visibleTypes = types.filter(
    (type) =>
      (showIgnored || type.status !== "Ignored") &&
      (status === "All" || type.status === status) &&
      `${type.label} ${type.id}`.toLowerCase().includes(query.toLowerCase()),
  );
  const run = (action: () => Promise<{ cities: string[]; message: string }>) =>
    startTransition(async () => {
      setError("");
      setMessage("");
      try {
        const result = await action();
        if (typeof BroadcastChannel !== "undefined") {
          const channel = new BroadcastChannel("poi-type-mappings");
          channel.postMessage(result.cities);
          channel.close();
        }
        setMessage(result.message);
      } catch (error) {
        setError(error instanceof Error ? error.message : "Could not save the changes. Try again.");
      }
    });
  return {
    draggedCategoryId,
    setDraggedCategoryId,
    moveCategory: (id: string, parent: string | null) =>
      run(async () => {
        setDraggedCategoryId(null);
        if (!categoryActions) throw new Error("Category editing is unavailable.");
        return {
          ...(await categoryActions.move(id, parent)),
          message: "Category moved. Shared type rules and visitor filters are updated.",
        };
      }),
    types,
    visibleTypes,
    selected: visibleTypes.find((type) => type.id === selectedId) ?? visibleTypes[0],
    dismissMessage: () => setMessage(""),
    setSelectedId,
    query,
    setQuery,
    status,
    setStatus,
    saving,
    message,
    error,
    showIgnored,
    setShowIgnored: (checked: boolean) => {
      setShowIgnored(checked);
      if (!checked && status === "Ignored") setStatus("All");
    },
    categories: catalog.categories ?? DEFAULT_POI_CATEGORY_DEFINITIONS,
    save: (id: string, categories: PoiCategory[] | null) =>
      run(async () => {
        const result = await saveRule(id, categories);
        return {
          ...result,
          message: `Rule saved. Updated ${result.updatedPois} POIs across ${result.cities.length} ${result.cities.length === 1 ? "city" : "cities"}. Visitor category filters now use the saved rule.`,
        };
      }),
    saveCategory: (id: string | null, name: string) =>
      run(async () => {
        if (!categoryActions) throw new Error("Category editing is unavailable.");
        return {
          ...(await categoryActions.save(id, name)),
          message: "Category saved. Visitor category names are updated.",
        };
      }),
    deleteCategory: (id: string) =>
      run(async () => {
        if (!categoryActions) throw new Error("Category editing is unavailable.");
        const result = await categoryActions.delete(id);
        return {
          ...result,
          message: `Category deleted. Updated ${result.updatedPois} POIs. Types with no remaining categories are Unmapped and will not be reclassified automatically.`,
        };
      }),
    classifyUnmapped: () =>
      run(async () => {
        if (!classifyRules || !aiSelectionRef)
          throw new Error("Automatic classification is unavailable.");
        const form = new FormData();
        form.set("aiMode", aiSelectionRef.current.mode);
        form.set("aiModel", aiSelectionRef.current.model);
        const result = await classifyRules(form);
        return {
          ...result,
          message: `Classified ${result.classified} types, created ${result.createdCategories} categories, and updated ${result.updatedPois} POIs. Manual rules and ignored types were preserved.`,
        };
      }),
  };
};
