import type { GeoJsonFeature } from "./types";

export const toCitySlug = (city: string) =>
  city
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const sanitizePoiIdForFile = (poiId: string) => {
  const normalized = poiId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "unknown-poi";
};

export const pickString = (properties: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) {
    const value = properties[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }

  return undefined;
};

export const getFeatureId = (feature: GeoJsonFeature, fallback: string) => {
  if (typeof feature.wikidataId === "string" && feature.wikidataId.trim().length > 0) {
    return feature.wikidataId;
  }

  if (typeof feature.id === "string" && feature.id.trim().length > 0) {
    return feature.id;
  }

  if (typeof feature.id === "number") {
    return `${feature.id}`;
  }

  const properties = feature.properties ?? {};
  return pickString(properties, "id", "@id") ?? fallback;
};

export const parseEnglishWikipediaTitle = (value?: string) => {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!/^en:/i.test(trimmed)) {
    return undefined;
  }

  const title = trimmed.slice(3).trim();
  if (!title) {
    return undefined;
  }

  return title.replace(/_/g, " ");
};
