import { readFileSync } from "node:fs";
import path from "node:path";
import snapshot from "../../../data/public/catalog.json";
import type { PublicCatalog } from "./types";

export const createPublicCatalog = (readCatalog: () => PublicCatalog) => ({
  getCategoryDefinitions: () => readCatalog().categoryDefinitions,
  getPois: (city: string) => {
    const catalog = readCatalog();
    return city === catalog.city ? catalog.pois.map(({ poi }) => poi) : [];
  },
  getStoryContent: (city: string, poiId: string) => {
    const catalog = readCatalog();
    return city === catalog.city
      ? catalog.pois.find(({ poi }) => poi.id === poiId)?.storyContent
      : undefined;
  },
  getPerson: (personId: string) => readCatalog().people.find(({ id }) => id === personId),
});

export const publicCatalog = createPublicCatalog(() =>
  process.env.NODE_ENV === "production"
    ? (snapshot as PublicCatalog)
    : (JSON.parse(
        readFileSync(path.join(process.cwd(), "data", "public", "catalog.json"), "utf-8"),
      ) as PublicCatalog),
);
