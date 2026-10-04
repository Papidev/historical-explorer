import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  expandPoiCategorySelection,
  DEFAULT_POI_CATEGORY_DEFINITIONS,
  type PoiCategoryDefinition,
  type PoiCategory,
} from "@/types/PoiCategory";
import type { GeoJson } from "@/server/wikiPipeline/types";

import { readPoiCategoryCatalog } from "@/server/poiCategoryCatalog";

export const derivePoiCategories = (
  types: Array<{ id: string }>,
  mappings: Record<string, PoiCategory[]>,
  name = "",
  definitions: PoiCategoryDefinition[] = DEFAULT_POI_CATEGORY_DEFINITIONS,
): PoiCategory[] => {
  const categories = expandPoiCategorySelection(
    types.flatMap(({ id }) => mappings[id] ?? []),
    definitions,
    false,
  ).filter((category) => definitions.some(({ id }) => id === category));
  if (categories.includes("Churches & cathedrals")) return categories;
  if (!categories.some((category) => ["Church", "Basilica", "Cathedral"].includes(category)))
    return categories;
  if (/\bbasilica\b/i.test(name) && definitions.some(({ id }) => id === "Basilica")) {
    return [
      ...new Set([
        ...categories.filter((category) => category !== "Cathedral"),
        "Basilica" as const,
      ]),
    ];
  }
  if (/\b(cathedral|cattedrale)\b/i.test(name) && definitions.some(({ id }) => id === "Cathedral"))
    return [...new Set([...categories, "Cathedral" as const])];
  return categories.includes("Cathedral")
    ? [
        ...new Set([
          ...categories.filter((category) => category !== "Cathedral"),
          ...(definitions.some(({ id }) => id === "Church") ? ["Church"] : []),
        ]),
      ]
    : categories;
};

export const createPoiCategoriesForCity = (
  city: string,
  dataDirectory = path.join(process.cwd(), "data"),
) => {
  const catalogPath = path.join(dataDirectory, city, "pois", "pois.geojson");
  const categoriesPath = path.join(dataDirectory, city, "pois", "categories.json");
  const mappings = () =>
    (
      JSON.parse(readFileSync(path.join(dataDirectory, "poi-type-category-map.json"), "utf-8")) as {
        version: number;
        mappings: Record<string, PoiCategory[]>;
      }
    ).mappings;

  const getAll = (): Record<string, PoiCategory[]> =>
    existsSync(categoriesPath)
      ? (
          JSON.parse(readFileSync(categoriesPath, "utf-8")) as {
            version: number;
            pois: Record<string, PoiCategory[]>;
          }
        ).pois
      : {};

  const save = (pois: Record<string, PoiCategory[]>) => {
    mkdirSync(path.dirname(categoriesPath), { recursive: true });
    writeFileSync(
      `${categoriesPath}.tmp`,
      `${JSON.stringify({ version: 1, pois }, null, 2)}\n`,
      "utf-8",
    );
    renameSync(`${categoriesPath}.tmp`, categoriesPath);
  };

  return {
    getAll,
    refresh: (poiId: string, types: Array<{ id: string }>) => {
      save({
        ...getAll(),
        [poiId]: derivePoiCategories(
          types,
          mappings(),
          String(
            (JSON.parse(readFileSync(catalogPath, "utf-8")) as GeoJson).features?.find(
              (feature) => String(feature.id) === poiId,
            )?.properties?.name ?? "",
          ),
          readPoiCategoryCatalog(dataDirectory).categories,
        ),
      });
    },
    rebuild: () => {
      if (!existsSync(catalogPath)) return;
      const catalog = JSON.parse(readFileSync(catalogPath, "utf-8")) as GeoJson;
      const rules = mappings();
      save(
        Object.fromEntries(
          (catalog.features ?? []).map((feature) => {
            const typesPath = path.join(
              dataDirectory,
              city,
              "generated",
              "wikidata",
              `${
                String(feature.id)
                  .trim()
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/^-+|-+$/g, "") || "unknown-poi"
              }.json`,
            );
            return [
              String(feature.id),
              derivePoiCategories(
                feature.wikidataId && existsSync(typesPath)
                  ? (
                      JSON.parse(readFileSync(typesPath, "utf-8")) as {
                        types: Array<{ id: string }>;
                      }
                    ).types
                  : [],
                rules,
                String(feature.properties?.name ?? ""),
                readPoiCategoryCatalog(dataDirectory).categories,
              ),
            ];
          }),
        ),
      );
    },
  };
};
