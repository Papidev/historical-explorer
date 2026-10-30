// Preserves the private Admin category interpretation semantics for online recalculation.
import { z } from "zod";

export const categorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  label: z.string().optional(),
  parent: z.string().optional(),
  supersedes: z.array(z.string()).optional(),
});
export type CategoryDefinition = z.infer<typeof categorySchema>;

export const expandCategorySelection = (
  selected: string[],
  definitions: CategoryDefinition[],
  includeParents = true,
) => {
  const expanded = [
    ...new Set(
      selected.flatMap((id) => [
        id,
        ...(definitions.some((category) => category.parent === id && selected.includes(category.id))
          ? []
          : definitions
              .filter((category) => category.parent === id)
              .map((category) => category.id)),
      ]),
    ),
  ];
  return includeParents
    ? [
        ...new Set([
          ...expanded,
          ...definitions
            .filter((category) => category.parent && expanded.includes(category.id))
            .map((category) => category.parent!),
        ]),
      ]
    : expanded;
};

export const derivePoiCategories = (
  types: Array<{ id: string }>,
  mappings: Record<string, string[]>,
  definitions: CategoryDefinition[],
  name: string,
) => {
  const valid = new Set(definitions.map(({ id }) => id));
  const categories = expandCategorySelection(
    types.flatMap(({ id }) => mappings[id] ?? []),
    definitions,
    false,
  ).filter((id) => valid.has(id));
  if (
    categories.includes("Churches & cathedrals") &&
    categories.some((id) => ["Church", "Basilica", "Cathedral"].includes(id))
  ) {
    if (/\bbasilica\b/i.test(name) && valid.has("Basilica"))
      return [...new Set([...categories.filter((id) => id !== "Cathedral"), "Basilica"])];
    if (/\b(cathedral|cattedrale)\b/i.test(name) && valid.has("Cathedral"))
      return [...new Set([...categories, "Cathedral"])];
    if (categories.includes("Cathedral") && valid.has("Church"))
      return [...new Set([...categories.filter((id) => id !== "Cathedral"), "Church"])];
  }
  return categories;
};
