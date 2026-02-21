import { readFileSync } from "node:fs";
import { getFeatureId, pickString } from "./normalize";
import type { GeoJson } from "./types";

const parseGeoJson = (raw: string): GeoJson => {
  try {
    return JSON.parse(raw) as GeoJson;
  } catch {
    const withoutTrailingCommas = raw.replace(/,\s*([}\]])/g, "$1");
    return JSON.parse(withoutTrailingCommas) as GeoJson;
  }
};

export const resolveContentSlugForPoi = (geoJsonPath: string, poiId: string): string => {
  const raw = readFileSync(geoJsonPath, "utf-8");
  const geoJson = parseGeoJson(raw);
  const features = geoJson.features ?? [];

  for (let i = 0; i < features.length; i += 1) {
    const feature = features[i];
    if (feature.geometry?.type !== "Point") {
      continue;
    }

    const featureId = getFeatureId(feature, `poi-${i}`);
    if (featureId !== poiId) {
      continue;
    }

    const properties = feature.properties ?? {};
    const contentSlug = pickString(properties, "content_slug", "content:slug", "mdx_slug");
    if (!contentSlug) {
      throw new Error(`POI ${poiId} has no content_slug in ${geoJsonPath}.`);
    }

    return contentSlug;
  }

  throw new Error(`POI ${poiId} not found in ${geoJsonPath}.`);
};
