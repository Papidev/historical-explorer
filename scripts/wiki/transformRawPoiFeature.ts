import type { GeoJsonFeature } from "./types";

const SINGLE_POI_PROPERTY_KEYS = [
  "addr:city",
  "addr:country",
  "addr:housename",
  "addr:housenumber",
  "addr:postcode",
  "addr:street",
  "email",
  "museum",
  "name",
  "name:en",
  "operator",
  "operator:type",
  "tourism",
  "website",
  "wikidata",
  "wikimedia_commons",
  "wikipedia",
] as const;

export const transformRawPoiFeature = (
  feature: GeoJsonFeature,
  { poiId, contentSlug }: { poiId: string; contentSlug: string },
) => {
  const properties = feature.properties ?? {};
  const transformedProperties = SINGLE_POI_PROPERTY_KEYS.reduce<Record<string, unknown>>((acc, key) => {
    const value = properties[key];
    if (typeof value === "string" && value.trim().length > 0) {
      acc[key] = value;
    }

    return acc;
  }, {});

  transformedProperties.content_slug = contentSlug;

  return {
    type: "Feature",
    id: poiId,
    properties: transformedProperties,
    geometry: feature.geometry,
  };
};
