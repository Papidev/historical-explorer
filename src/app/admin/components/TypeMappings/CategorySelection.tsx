import { type PoiCategoryDefinition } from "@/types/PoiCategory";

export const CategorySelection = ({
  category,
  draft,
  definitions,
  onChange,
}: {
  category: PoiCategoryDefinition;
  draft: string[];
  definitions: PoiCategoryDefinition[];
  onChange: (categories: string[]) => void;
}) => (
  <label className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-200 p-2 text-sm text-gray-700 has-checked:border-indigo-300 has-checked:bg-indigo-50 has-disabled:cursor-not-allowed has-disabled:opacity-60">
    <input
      className="size-4 cursor-pointer accent-indigo-600 disabled:cursor-not-allowed"
      type="checkbox"
      checked={draft.includes(category.id)}
      onChange={(event) => {
        if (event.target.checked) {
          onChange(
            category.parent
              ? [...new Set([...draft, category.id, category.parent])]
              : [
                  ...new Set([
                    ...draft,
                    category.id,
                    ...definitions
                      .filter((child) => child.parent === category.id)
                      .map((child) => child.id),
                  ]),
                ],
          );
        } else {
          const remaining = draft.filter(
            (id) =>
              id !== category.id &&
              !definitions.some((child) => child.id === id && child.parent === category.id),
          );
          onChange(
            category.parent &&
              !definitions.some(
                (child) => child.parent === category.parent && remaining.includes(child.id),
              )
              ? remaining.filter((id) => id !== category.parent)
              : remaining,
          );
        }
      }}
    />
    {category.name}
  </label>
);
