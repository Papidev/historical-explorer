"use server";

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { toCitySlug } from "../../../../scripts/wiki/normalize";
import { transformRawPoiFeature } from "../../../../scripts/wiki/transformRawPoiFeature";

type GeoJsonFeature = {
  id?: string | number;
  properties?: Record<string, unknown>;
  geometry?: {
    type?: string;
    coordinates?: number[];
  };
};

type GeoJson = {
  type?: string;
  generator?: string;
  copyright?: string;
  timestamp?: string;
  features?: GeoJsonFeature[];
};

const parseGeoJson = (filePath: string) => JSON.parse(readFileSync(filePath, "utf-8")) as GeoJson;

export const generateSinglePoiJson = async (formData: FormData) => {
  const rawFeatureIndex = Number(formData.get("rawFeatureIndex"));
  if (!Number.isInteger(rawFeatureIndex) || rawFeatureIndex < 0) {
    throw new Error("Invalid raw feature index.");
  }

  const rawPath = path.join(process.cwd(), "public", "data", "raw", "rome-pois-raw.geojson");
  const transformedPath = path.join(process.cwd(), "public", "data", "rome-pois.geojson");
  const rawGeoJson = parseGeoJson(rawPath);
  const transformedGeoJson = parseGeoJson(transformedPath);
  const rawFeature = rawGeoJson.features?.[rawFeatureIndex];

  if (!rawFeature) {
    throw new Error(`Raw feature ${rawFeatureIndex} not found.`);
  }

  const properties = rawFeature.properties ?? {};
  const fallbackId = `missing-id-${rawFeatureIndex}`;
  const poiId =
    (typeof rawFeature.id === "string" && rawFeature.id.trim()) ||
    (typeof rawFeature.id === "number" ? `${rawFeature.id}` : "") ||
    fallbackId;
  const name = (typeof properties.name === "string" && properties.name.trim()) || poiId;
  const transformedFeature = transformRawPoiFeature(rawFeature, { poiId, contentSlug: toCitySlug(name) });
  const existingFeatures = transformedGeoJson.features ?? [];
  const existingFeatureIndex = existingFeatures.findIndex((feature) => feature.id === poiId);

  const nextFeatures =
    existingFeatureIndex >= 0
      ? existingFeatures.map((feature, index) => (index === existingFeatureIndex ? transformedFeature : feature))
      : [...existingFeatures, transformedFeature];

  const nextGeoJson = {
    type: rawGeoJson.type ?? "FeatureCollection",
    generator: rawGeoJson.generator,
    copyright: rawGeoJson.copyright,
    timestamp: rawGeoJson.timestamp,
    features: nextFeatures,
  };

  writeFileSync(transformedPath, `${JSON.stringify(nextGeoJson, null, 2)}\n`, "utf-8");
  revalidatePath("/admin");
};

export const deleteSinglePoiJson = async (formData: FormData) => {
  const poiId = formData.get("poiId");
  if (typeof poiId !== "string" || poiId.trim().length === 0) {
    throw new Error("Invalid POI id.");
  }

  const transformedPath = path.join(process.cwd(), "public", "data", "rome-pois.geojson");
  const transformedGeoJson = parseGeoJson(transformedPath);
  const nextFeatures = (transformedGeoJson.features ?? []).filter((feature) => feature.id !== poiId);

  const nextGeoJson = {
    type: transformedGeoJson.type ?? "FeatureCollection",
    generator: transformedGeoJson.generator,
    copyright: transformedGeoJson.copyright,
    timestamp: transformedGeoJson.timestamp,
    features: nextFeatures,
  };

  writeFileSync(transformedPath, `${JSON.stringify(nextGeoJson, null, 2)}\n`, "utf-8");
  revalidatePath("/admin");
};
