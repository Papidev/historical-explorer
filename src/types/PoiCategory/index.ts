export const POI_TOP_LEVEL_CATEGORIES = [
  "Church",
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
  { name: "Basilica", parent: "Church" },
] as const satisfies readonly {
  name: string;
  parent: (typeof POI_TOP_LEVEL_CATEGORIES)[number];
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

export const matchesPoiCategory = (categories: PoiCategory[] | undefined, selected: PoiCategory) =>
  Boolean(
    categories?.some(
      (category) => category === selected || POI_CATEGORY_PARENTS[category] === selected,
    ),
  );
