import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { PoiCategory } from "@/types/PoiCategory";
import type { GeoJson } from "@/server/wikiPipeline/types";

export const derivePoiCategories = (
  types: Array<{ id: string }>,
  mappings: Record<string, PoiCategory[]>,
): PoiCategory[] => [...new Set(types.flatMap(({ id }) => mappings[id] ?? []))];

export const createPoiCategoriesForCity = (
  city: string,
  dataDirectory = path.join(process.cwd(), "data"),
) => {
  const catalogPath = path.join(dataDirectory, city, "pois", "pois.geojson");
  const mappings = () =>
    (
      JSON.parse(readFileSync(path.join(dataDirectory, "poi-type-category-map.json"), "utf-8")) as {
        version: number;
        mappings: Record<string, PoiCategory[]>;
      }
    ).mappings;

  const applyToCatalog = (catalog: GeoJson): GeoJson => {
    const rules = mappings();
    return {
      ...catalog,
      features: catalog.features?.map((feature) => {
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
        return {
          ...feature,
          categories: derivePoiCategories(
            feature.wikidataId && existsSync(typesPath)
              ? (JSON.parse(readFileSync(typesPath, "utf-8")) as { types: Array<{ id: string }> })
                  .types
              : [],
            rules,
          ),
        };
      }),
    };
  };

  const saveCatalog = (catalog: GeoJson) => {
    writeFileSync(`${catalogPath}.tmp`, `${JSON.stringify(catalog, null, 2)}\n`, "utf-8");
    renameSync(`${catalogPath}.tmp`, catalogPath);
  };

  return {
    applyToCatalog,
    refresh: (poiId: string, types: Array<{ id: string }>) => {
      if (!existsSync(catalogPath)) return;
      const catalog = JSON.parse(readFileSync(catalogPath, "utf-8")) as GeoJson;
      saveCatalog({
        ...catalog,
        features: catalog.features?.map((feature) =>
          feature.id === poiId
            ? { ...feature, categories: derivePoiCategories(types, mappings()) }
            : feature,
        ),
      });
    },
    rebuild: () => {
      if (existsSync(catalogPath)) {
        saveCatalog(applyToCatalog(JSON.parse(readFileSync(catalogPath, "utf-8")) as GeoJson));
      }
    },
  };
};
