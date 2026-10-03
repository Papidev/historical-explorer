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

export type PoiCategory =
  | (typeof POI_TOP_LEVEL_CATEGORIES)[number]
  | (typeof POI_SUBCATEGORIES)[number]["name"];

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

export const matchesPoiCategory = (categories: PoiCategory[] | undefined, selected: PoiCategory) =>
  Boolean(
    !POI_SUBCATEGORIES.some(
      ({ name, supersedes }) =>
        categories?.includes(name) && supersedes.some((category) => category === selected),
    ) &&
    categories?.some(
      (category) => category === selected || POI_CATEGORY_PARENTS[category] === selected,
    ),
  );
