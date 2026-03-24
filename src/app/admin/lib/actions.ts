"use server";

import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { fetchWikiSnapshot } from "../../../../scripts/wiki/fetchWiki";
import { buildOutputFilePath, findPoiInGeoJson, getDefaultOutputDir, writeSnapshotFile } from "../../../../scripts/wiki/io";
import { sanitizePoiIdForFile, toCitySlug } from "../../../../scripts/wiki/normalize";
import { resolvePageForPoi } from "../../../../scripts/wiki/resolve";
import { transformRawPoiFeature } from "../../../../scripts/wiki/transformRawPoiFeature";
import type { WikiSnapshotFile } from "../../../../scripts/wiki/types";
import { wikiTextToMdx } from "../../../../scripts/wiki/wikiToMdx";

type GeoJsonFeature = {
  id?: string | number;
  wikidataId?: string;
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

const city = "rome";
const rawPath = path.join(process.cwd(), "public", "data", "raw", "rome-pois-raw.geojson");
const transformedPath = path.join(process.cwd(), "public", "data", "rome-pois.geojson");
const mdxDirectoryPath = path.join(process.cwd(), "content", "pois", toCitySlug(city));

const getPoiIdFromRawFeature = (rawFeature: GeoJsonFeature, rawFeatureIndex: number) => {
  const properties = rawFeature.properties ?? {};
  const poiId = typeof properties.wikidata === "string" ? properties.wikidata.trim() : "";
  if (!poiId) {
    throw new Error(`Raw feature ${rawFeatureIndex} has no wikidata id.`);
  }

  return poiId;
};

const findRawFeatureByPoiId = (poiId: string) => {
  const rawGeoJson = parseGeoJson(rawPath);
  const rawFeatures = rawGeoJson.features ?? [];
  const rawFeatureIndex = rawFeatures.findIndex((feature) => {
    const wikidata = typeof feature.properties?.wikidata === "string" ? feature.properties.wikidata.trim() : "";
    return wikidata === poiId;
  });
  if (rawFeatureIndex < 0) {
    throw new Error(`Raw feature for ${poiId} not found.`);
  }

  const rawFeature = rawFeatures[rawFeatureIndex];
  if (!rawFeature) {
    throw new Error(`Raw feature for ${poiId} not found.`);
  }

  return { rawFeature, rawFeatureIndex, rawGeoJson };
};

const writeTransformedPoi = (rawFeature: GeoJsonFeature, rawFeatureIndex: number, rawGeoJson: GeoJson) => {
  const poiId = getPoiIdFromRawFeature(rawFeature, rawFeatureIndex);
  const transformedGeoJson = parseGeoJson(transformedPath);
  const properties = rawFeature.properties ?? {};
  const name = (typeof properties.name === "string" && properties.name.trim()) || poiId;
  const transformedFeature = transformRawPoiFeature(rawFeature, { poiId, contentSlug: toCitySlug(name) });
  const existingFeatures = transformedGeoJson.features ?? [];
  const existingFeatureIndex = existingFeatures.findIndex((feature) => feature.wikidataId === poiId);
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
  return poiId;
};

const writeWikiSnapshot = async (poiId: string) => {
  const inputPath = path.join(process.cwd(), "public", "data", `${toCitySlug(city)}-pois.geojson`);
  const outputDir = getDefaultOutputDir();
  const poi = findPoiInGeoJson(inputPath, poiId, city);
  const outputFilePath = buildOutputFilePath(outputDir, poi.id);
  const resolved = await resolvePageForPoi(poi);
  const snapshot = await fetchWikiSnapshot(resolved.selected.title);
  const payload: WikiSnapshotFile = {
    id: poi.id,
    content: snapshot.fullText,
  };

  writeSnapshotFile(outputFilePath, payload);
};

const writeMdxFile = (poiId: string) => {
  const wikiJsonPath = buildOutputFilePath(getDefaultOutputDir(), poiId);
  if (!existsSync(wikiJsonPath)) {
    throw new Error(`Wiki JSON not found for ${poiId}.`);
  }

  const raw = readFileSync(wikiJsonPath, "utf-8");
  const parsed = JSON.parse(raw) as Partial<WikiSnapshotFile>;
  if (typeof parsed.content !== "string" || parsed.content.trim().length === 0) {
    throw new Error(`Invalid wiki JSON for ${poiId}.`);
  }

  const outputFilePath = path.join(mdxDirectoryPath, `${sanitizePoiIdForFile(poiId)}.mdx`);
  writeFileSync(outputFilePath, wikiTextToMdx(parsed.content), "utf-8");
};

const refreshTransformedPoiPipeline = async (poiId: string) => {
  const { rawFeature, rawFeatureIndex, rawGeoJson } = findRawFeatureByPoiId(poiId);
  const refreshedPoiId = writeTransformedPoi(rawFeature, rawFeatureIndex, rawGeoJson);
  await writeWikiSnapshot(refreshedPoiId);
  writeMdxFile(refreshedPoiId);
};

const refreshWikiPipeline = async (poiId: string) => {
  await writeWikiSnapshot(poiId);
  writeMdxFile(poiId);
};

const deleteMdxFile = (poiId: string) => {
  const outputFilePath = path.join(mdxDirectoryPath, `${sanitizePoiIdForFile(poiId)}.mdx`);
  if (existsSync(outputFilePath)) {
    unlinkSync(outputFilePath);
  }
};

const deleteWikiSnapshotFile = (poiId: string) => {
  const outputFilePath = buildOutputFilePath(getDefaultOutputDir(), poiId);
  if (existsSync(outputFilePath)) {
    unlinkSync(outputFilePath);
  }
};

const deleteWikiPipeline = (poiId: string) => {
  deleteWikiSnapshotFile(poiId);
  deleteMdxFile(poiId);
};

const deleteTransformedPoiPipeline = (poiId: string) => {
  const transformedGeoJson = parseGeoJson(transformedPath);
  const nextFeatures = (transformedGeoJson.features ?? []).filter((feature) => feature.wikidataId !== poiId);
  const nextGeoJson = {
    type: transformedGeoJson.type ?? "FeatureCollection",
    generator: transformedGeoJson.generator,
    copyright: transformedGeoJson.copyright,
    timestamp: transformedGeoJson.timestamp,
    features: nextFeatures,
  };

  writeFileSync(transformedPath, `${JSON.stringify(nextGeoJson, null, 2)}\n`, "utf-8");
  deleteWikiPipeline(poiId);
};

export const generateSinglePoiJson = async (formData: FormData) => {
  const rawFeatureIndex = Number(formData.get("rawFeatureIndex"));
  if (!Number.isInteger(rawFeatureIndex) || rawFeatureIndex < 0) {
    throw new Error("Invalid raw feature index.");
  }

  const rawGeoJson = parseGeoJson(rawPath);
  const rawFeature = rawGeoJson.features?.[rawFeatureIndex];

  if (!rawFeature) {
    throw new Error(`Raw feature ${rawFeatureIndex} not found.`);
  }

  const poiId = writeTransformedPoi(rawFeature, rawFeatureIndex, rawGeoJson);
  await writeWikiSnapshot(poiId);
  writeMdxFile(poiId);
  revalidatePath("/admin");
};

export const refreshTransformedPoiJson = async (formData: FormData) => {
  const poiId = formData.get("poiId");
  if (typeof poiId !== "string" || poiId.trim().length === 0) {
    throw new Error("Invalid POI id.");
  }

  await refreshTransformedPoiPipeline(poiId);
  revalidatePath("/admin");
};

export const refreshWikiJson = async (formData: FormData) => {
  const poiId = formData.get("poiId");
  if (typeof poiId !== "string" || poiId.trim().length === 0) {
    throw new Error("Invalid POI id.");
  }

  await refreshWikiPipeline(poiId);
  revalidatePath("/admin");
};

export const refreshMdx = async (formData: FormData) => {
  const poiId = formData.get("poiId");
  if (typeof poiId !== "string" || poiId.trim().length === 0) {
    throw new Error("Invalid POI id.");
  }

  writeMdxFile(poiId);
  revalidatePath("/admin");
};

export const deleteTransformedPoiJson = async (formData: FormData) => {
  const poiId = formData.get("poiId");
  if (typeof poiId !== "string" || poiId.trim().length === 0) {
    throw new Error("Invalid POI id.");
  }

  deleteTransformedPoiPipeline(poiId);
  revalidatePath("/admin");
};

export const deleteWikiJson = async (formData: FormData) => {
  const poiId = formData.get("poiId");
  if (typeof poiId !== "string" || poiId.trim().length === 0) {
    throw new Error("Invalid POI id.");
  }

  deleteWikiPipeline(poiId);
  revalidatePath("/admin");
};

export const deleteMdx = async (formData: FormData) => {
  const poiId = formData.get("poiId");
  if (typeof poiId !== "string" || poiId.trim().length === 0) {
    throw new Error("Invalid POI id.");
  }

  deleteMdxFile(poiId);
  revalidatePath("/admin");
};
