export const POI_TOP_LEVEL_CATEGORIES = [
  "Churches & cathedrals",
  "Arts & Culture",
  "Other places",
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
  { name: "Abbey", label: "Abbeys", parent: "Churches & cathedrals", supersedes: [] },
  { name: "Baptistery", label: "Baptisteries", parent: "Churches & cathedrals", supersedes: [] },
  { name: "Temple", label: "Temples", parent: "Churches & cathedrals", supersedes: [] },
  { name: "Museum", label: "Museums", parent: "Arts & Culture", supersedes: [] },
  { name: "Library", label: "Libraries", parent: "Arts & Culture", supersedes: [] },
  { name: "Archive", label: "Archives", parent: "Arts & Culture", supersedes: [] },
  { name: "Academy", label: "Academies", parent: "Arts & Culture", supersedes: [] },
  { name: "Castle", parent: "Other places", supersedes: [] },
  { name: "Mausoleum", parent: "Other places", supersedes: [] },
  { name: "Aqueduct", parent: "Other places", supersedes: [] },
  { name: "Amphitheatre", parent: "Other places", supersedes: [] },
  { name: "Arch", parent: "Other places", supersedes: [] },
  { name: "Square", parent: "Other places", supersedes: [] },
  { name: "Archaeological Site", parent: "Other places", supersedes: [] },
  { name: "Palace", parent: "Other places", supersedes: [] },
  { name: "Tower", parent: "Other places", supersedes: [] },
  { name: "Guild", parent: "Other places", supersedes: [] },
  { name: "Lost sculpture", parent: "Other places", supersedes: [] },
  { name: "Street", parent: "Other places", supersedes: [] },
  { name: "Cemetery", parent: "Other places", supersedes: [] },
  { name: "Monument", parent: "Other places", supersedes: [] },
  { name: "Fountain", parent: "Other places", supersedes: [] },
  { name: "Fort", parent: "Other places", supersedes: [] },
  { name: "Garden", parent: "Other places", supersedes: [] },
  { name: "Park", parent: "Other places", supersedes: [] },
  { name: "Grave", parent: "Other places", supersedes: [] },
  { name: "Villa", parent: "Other places", supersedes: [] },
] as const satisfies readonly {
  name: string;
  label?: string;
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
  POI_SUBCATEGORIES.filter((category) => "label" in category).map(({ name, label }) => [
    name,
    label,
  ]),
) as Partial<Record<PoiCategory, string>>;

export const DEFAULT_POI_CATEGORY_DEFINITIONS: PoiCategoryDefinition[] = POI_CATEGORIES.map(
  (id) => ({
    id,
    name: id === "Churches & cathedrals" ? "Religion" : id,
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
