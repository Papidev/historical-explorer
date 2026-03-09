import { readFileSync } from "node:fs";
import path from "node:path";

type GeoJsonFeature = {
  id?: string | number;
  properties?: Record<string, unknown>;
};

type GeoJson = {
  features?: GeoJsonFeature[];
};

export type AdminPoiListItem = {
  id: string;
  name: string;
  wikidata?: string;
  source: "raw" | "target";
};

export type PoiImportComparisonData = {
  rawPois: AdminPoiListItem[];
  targetPois: AdminPoiListItem[];
};

const toCitySlug = (city: string) =>
  city
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const pickString = (properties: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) {
    const value = properties[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
};

const parseGeoJson = (filePath: string): GeoJson => {
  const raw = readFileSync(filePath, "utf-8");

  try {
    return JSON.parse(raw) as GeoJson;
  } catch {
    const withoutTrailingCommas = raw.replace(/,\s*([}\]])/g, "$1");
    return JSON.parse(withoutTrailingCommas) as GeoJson;
  }
};

const buildTargetGeoJsonPath = (city: string) =>
  path.join(process.cwd(), "public", "data", `${toCitySlug(city)}-pois.geojson`);

const buildRawGeoJsonPath = (city: string) =>
  path.join(process.cwd(), "public", "data", "raw", `${toCitySlug(city)}-pois-raw.geojson`);

const mapFeatureToAdminPoi = (
  feature: GeoJsonFeature,
  index: number,
  source: "raw" | "target",
): AdminPoiListItem => {
  const properties = feature.properties ?? {};
  const id =
    (typeof feature.id === "string" && feature.id.trim()) ||
    (typeof feature.id === "number" ? `${feature.id}` : undefined) ||
    pickString(properties, "@id") ||
    `poi-${index}`;
  const name = pickString(properties, "name", "name:en", "name:it") ?? id;
  const wikidata = pickString(properties, "wikidata");

  return {
    id,
    name,
    wikidata,
    source,
  };
};

export const getPoiImportComparisonData = (city: string): PoiImportComparisonData => {
  const rawPath = buildRawGeoJsonPath(city);
  const targetPath = buildTargetGeoJsonPath(city);

  const rawGeoJson = parseGeoJson(rawPath);
  const targetGeoJson = parseGeoJson(targetPath);

  const rawFeatures = rawGeoJson.features ?? [];
  const targetFeatures = targetGeoJson.features ?? [];

  return {
    rawPois: rawFeatures.map((feature, index) => mapFeatureToAdminPoi(feature, index, "raw")),
    targetPois: targetFeatures.map((feature, index) =>
      mapFeatureToAdminPoi(feature, index, "target"),
    ),
  };
};
