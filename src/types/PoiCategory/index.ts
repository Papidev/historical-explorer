export const POI_TOP_LEVEL_CATEGORIES = [
  "Churches & cathedrals",
  "Museum",
  "Castle",
  "Mausoleum",
  "Aqueduct",
  "Amphitheatre",
  "Arch",
  "Square",
  "Archaeological Site",
] as const;

export const POI_SUBCATEGORIES = [
  {
    name: "Cathedral",
    label: "Cathedrals",
    parent: "Churches & cathedrals",
    supersedes: ["Basilica", "Church"],
  },
  { name: "Basilica", label: "Basilicas", parent: "Churches & cathedrals", supersedes: ["Church"] },
  { name: "Church", label: "Churches", parent: "Churches & cathedrals", supersedes: [] },
] as const satisfies readonly {
  name: string;
  label: string;
  parent: (typeof POI_TOP_LEVEL_CATEGORIES)[number];
  supersedes: readonly string[];
}[];

// Category IDs stay stable when their display names are edited.
export type PoiCategory = string;
export type PoiCategoryDefinition = {
  id: PoiCategory;
  name: string;
  label?: string;
  parent?: PoiCategory;
  supersedes?: PoiCategory[];
};

export const POI_CATEGORIES: PoiCategory[] = POI_TOP_LEVEL_CATEGORIES.flatMap((parent) => [
  parent,
  ...POI_SUBCATEGORIES.filter((category) => category.parent === parent).map(({ name }) => name),
]);

export const POI_CATEGORY_PARENTS = Object.fromEntries(
  POI_SUBCATEGORIES.map(({ name, parent }) => [name, parent]),
) as Partial<Record<PoiCategory, (typeof POI_TOP_LEVEL_CATEGORIES)[number]>>;

export const POI_CATEGORY_LABELS = Object.fromEntries(
  POI_SUBCATEGORIES.map(({ name, label }) => [name, label]),
) as Partial<Record<PoiCategory, string>>;

export const DEFAULT_POI_CATEGORY_DEFINITIONS: PoiCategoryDefinition[] = POI_CATEGORIES.map(
  (id) => ({
    id,
    name: id,
    ...(POI_CATEGORY_LABELS[id] ? { label: POI_CATEGORY_LABELS[id] } : {}),
    ...(POI_CATEGORY_PARENTS[id] ? { parent: POI_CATEGORY_PARENTS[id] } : {}),
    ...(POI_SUBCATEGORIES.find((category) => category.name === id)
      ? {
          supersedes: [
            ...(POI_SUBCATEGORIES.find((category) => category.name === id)?.supersedes ?? []),
          ],
        }
      : {}),
  }),
);

export const matchesPoiCategory = (
  categories: PoiCategory[] | undefined,
  selected: PoiCategory,
  definitions: PoiCategoryDefinition[] = DEFAULT_POI_CATEGORY_DEFINITIONS,
) =>
  Boolean(
    !definitions.some(
      ({ id, supersedes }) => categories?.includes(id) && supersedes?.includes(selected),
    ) &&
    categories?.some(
      (category) =>
        category === selected || definitions.find(({ id }) => id === category)?.parent === selected,
    ),
  );

// A parent with explicit children represents that subset; a parent alone selects all children.
export const expandPoiCategorySelection = (
  categories: PoiCategory[],
  definitions: PoiCategoryDefinition[],
  includeParents = true,
) => {
  const expanded = [
    ...new Set(
      categories.flatMap((id) => [
        id,
        ...(definitions.some(
          (category) => category.parent === id && categories.includes(category.id),
        )
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
            .filter((category) => expanded.includes(category.id) && category.parent)
            .map((category) => category.parent!),
        ]),
      ]
    : expanded;
};
