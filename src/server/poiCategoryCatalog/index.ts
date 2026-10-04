import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { DEFAULT_POI_CATEGORY_DEFINITIONS, type PoiCategoryDefinition } from "@/types/PoiCategory";

export type PoiCategoryCatalog = {
  version: number;
  categories: PoiCategoryDefinition[];
  deletedNames: string[];
};

export const readPoiCategoryCatalog = (
  directory = path.join(process.cwd(), "data"),
): PoiCategoryCatalog =>
  existsSync(path.join(directory, "poi-category-catalog.json"))
    ? JSON.parse(readFileSync(path.join(directory, "poi-category-catalog.json"), "utf-8"))
    : {
        version: 1,
        categories: structuredClone(DEFAULT_POI_CATEGORY_DEFINITIONS),
        deletedNames: [],
      };
