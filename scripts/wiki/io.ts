import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  getFeatureId,
  pickString,
  sanitizePoiIdForFile,
  toCitySlug,
} from "./normalize";
import type { GeoJson, PoiInput } from "./types";

const parseGeoJson = (raw: string): GeoJson => {
  try {
    return JSON.parse(raw) as GeoJson;
  } catch {
    const withoutTrailingCommas = raw.replace(/,\s*([}\]])/g, "$1");
    return JSON.parse(withoutTrailingCommas) as GeoJson;
  }
};

export const getDefaultInputPath = (city: string) =>
  path.join(
    process.cwd(),
    "data",
    "generated",
    toCitySlug(city),
    "pois.geojson",
  );

export const getDefaultOutputDir = (city: string) =>
  path.join(process.cwd(), "data", "generated", toCitySlug(city), "wiki");

export const findPoiInGeoJson = (
  inputPath: string,
  poiId: string,
  fallbackCity: string,
): PoiInput => {
  const raw = readFileSync(inputPath, "utf-8");
  const geoJson = parseGeoJson(raw);
  const features = geoJson.features ?? [];

  for (let i = 0; i < features.length; i += 1) {
    const feature = features[i];
    if (feature.geometry?.type !== "Point") {
      continue;
    }

    const id = getFeatureId(feature, `poi-${i}`);
    if (id !== poiId) {
      continue;
    }

    const [lng, lat] = feature.geometry.coordinates ?? [];
    if (typeof lat !== "number" || typeof lng !== "number") {
      throw new Error(`POI ${poiId} is missing numeric coordinates.`);
    }

    const properties = feature.properties ?? {};
    const name =
      pickString(properties, "name", "name:en", "name:it", "int_name") ?? id;
    const city =
      pickString(properties, "addr:city", "is_in:city") ?? fallbackCity;

    return {
      id,
      name,
      city,
      coordinates: { lat, lng },
      sourceHints: {
        wikipedia: pickString(properties, "wikipedia"),
        wikidata: pickString(properties, "wikidata"),
      },
    };
  }

  throw new Error(`POI ${poiId} not found in ${inputPath}.`);
};

export const buildOutputFilePath = (outputDir: string, poiId: string) =>
  path.join(outputDir, `${sanitizePoiIdForFile(poiId)}.txt`);

export const outputExists = (outputFilePath: string) =>
  existsSync(outputFilePath);

export const writeSnapshotFile = (outputFilePath: string, data: string) => {
  mkdirSync(path.dirname(outputFilePath), { recursive: true });
  writeFileSync(outputFilePath, `${data.trim()}\n`, "utf-8");
};
