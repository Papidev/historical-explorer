export const POI_CATEGORIES = [
  "Church",
  "Basilica",
  "Museum",
  "Castle",
  "Mausoleum",
  "Aqueduct",
  "Amphitheatre",
  "Arch",
  "Square",
  "Archaeological Site",
] as const;

export type PoiCategory = (typeof POI_CATEGORIES)[number];
