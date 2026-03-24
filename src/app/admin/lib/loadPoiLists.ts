import { readFileSync } from "node:fs";
import path from "node:path";
import type { GeoJson, GeoJsonFeature, PoiItem } from "./types";

const parseGeoJson = (filePath: string) => {
  const raw = readFileSync(filePath, "utf-8");

  return JSON.parse(raw) as GeoJson;
};

const toPoiItems = (features: GeoJsonFeature[] | undefined) =>
  (features ?? []).map((feature, index) => {
    const properties = feature.properties ?? {};
    const id =
      (typeof feature.id === "string" && feature.id.trim()) ||
      (typeof feature.id === "number" ? `${feature.id}` : "") ||
      `missing-id-${index}`;
    const name = (typeof properties.name === "string" && properties.name.trim()) || id;
    const wikidata = typeof properties.wikidata === "string" ? properties.wikidata.trim() : undefined;

    return { id, name, wikidata, featureIndex: index } satisfies PoiItem;
  });

export const loadPoiLists = () => {
  try {
    const rawPath = path.join(process.cwd(), "public", "data", "raw", "rome-pois-raw.geojson");
    const transformedPath = path.join(process.cwd(), "public", "data", "rome-pois.geojson");

    const rawPois = toPoiItems(parseGeoJson(rawPath).features);
    const transformedPois = toPoiItems(parseGeoJson(transformedPath).features);

    return { rawPois, transformedPois, error: null };
  } catch (error) {
    return {
      rawPois: [] as PoiItem[],
      transformedPois: [] as PoiItem[],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};
