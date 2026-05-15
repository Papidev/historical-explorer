"use server";

import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { enrichWikiText } from "../../../../scripts/wiki/enrichWiki";
import { fetchWikiSnapshot } from "../../../../scripts/wiki/fetchWiki";
import {
  buildOutputFilePath,
  findPoiInGeoJson,
  getDefaultOutputDir,
  writeSnapshotFile,
} from "../../../../scripts/wiki/io";
import {
  sanitizePoiIdForFile,
  toCitySlug,
} from "../../../../scripts/wiki/normalize";
import { resolvePageForPoi } from "../../../../scripts/wiki/resolve";
import { transformRawPoiFeature } from "../../../../scripts/wiki/transformRawPoiFeature";
import {
  plainTextToMdx,
  wikiTextToPlainText,
} from "../../../../scripts/wiki/wikiToMdx";
import {
  defaultAiModel,
  loadInstalledAiModelOptions,
  type AiModel,
} from "./aiModels";

type GenerationStep = "transformed" | "wiki" | "ai" | "mdx";

type GenerationMetadata = Record<
  string,
  Partial<
    Record<
      GenerationStep,
      { durationMs: number; completedAt: string; aiModel?: AiModel }
    >
  >
>;

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

const parseGeoJson = (filePath: string) =>
  JSON.parse(readFileSync(filePath, "utf-8")) as GeoJson;

const city = "rome";
const rawPath = path.join(
  process.cwd(),
  "public",
  "data",
  "raw",
  "rome-pois-raw.geojson",
);
const transformedPath = path.join(
  process.cwd(),
  "public",
  "data",
  "rome-pois.geojson",
);
const aiDirectoryPath = path.join(process.cwd(), "data", "wiki-ai");
const mdxDirectoryPath = path.join(
  process.cwd(),
  "content",
  "pois",
  toCitySlug(city),
);
const generationMetadataPath = path.join(
  process.cwd(),
  "data",
  "admin-generation-metadata.json",
);

const resolveAiModelFromFormData = async (formData: FormData) => {
  const installedModelOptions = await loadInstalledAiModelOptions();
  const aiModel = formData.get("aiModel");
  if (typeof aiModel === "string" && aiModel.trim().length > 0) {
    if (!installedModelOptions.some((option) => option.value === aiModel)) {
      throw new Error("Invalid AI model.");
    }

    return aiModel;
  }

  const configuredAiModel = process.env.OLLAMA_MODEL;
  if (
    configuredAiModel &&
    installedModelOptions.some((option) => option.value === configuredAiModel)
  ) {
    return configuredAiModel;
  }

  const installedDefaultAiModel = installedModelOptions.find(
    (option) => option.value === defaultAiModel,
  )?.value;
  if (installedDefaultAiModel) {
    return installedDefaultAiModel;
  }

  const firstInstalledAiModel = installedModelOptions[0]?.value;
  if (firstInstalledAiModel) {
    return firstInstalledAiModel;
  }

  throw new Error("No installed Ollama models found.");
};

const readGenerationMetadata = () => {
  if (!existsSync(generationMetadataPath)) {
    return {} as GenerationMetadata;
  }

  return JSON.parse(
    readFileSync(generationMetadataPath, "utf-8"),
  ) as GenerationMetadata;
};

const writeGenerationMetadata = (metadata: GenerationMetadata) => {
  mkdirSync(path.dirname(generationMetadataPath), { recursive: true });
  writeFileSync(
    generationMetadataPath,
    `${JSON.stringify(metadata, null, 2)}\n`,
    "utf-8",
  );
};

const recordGenerationDuration = (
  poiId: string,
  step: GenerationStep,
  durationMs: number,
  extraMetadata?: { aiModel?: AiModel },
) => {
  const normalizedPoiId = sanitizePoiIdForFile(poiId);
  const metadata = readGenerationMetadata();

  writeGenerationMetadata({
    ...metadata,
    [normalizedPoiId]: {
      ...metadata[normalizedPoiId],
      [step]: {
        durationMs,
        completedAt: new Date().toISOString(),
        ...extraMetadata,
      },
    },
  });
};

const clearGenerationDurations = (poiId: string, steps: GenerationStep[]) => {
  const normalizedPoiId = sanitizePoiIdForFile(poiId);
  const metadata = readGenerationMetadata();
  const poiMetadata = metadata[normalizedPoiId];
  if (!poiMetadata) {
    return;
  }

  for (const step of steps) {
    delete poiMetadata[step];
  }

  if (Object.keys(poiMetadata).length === 0) {
    delete metadata[normalizedPoiId];
  } else {
    metadata[normalizedPoiId] = poiMetadata;
  }

  writeGenerationMetadata(metadata);
};

const measureGeneration = async <Result>(
  poiId: string,
  step: GenerationStep,
  action: () => Result | Promise<Result>,
  metadata?: { aiModel?: AiModel },
) => {
  const startedAt = Date.now();
  const result = await action();
  recordGenerationDuration(poiId, step, Date.now() - startedAt, metadata);

  return result;
};

const getPoiIdFromRawFeature = (
  rawFeature: GeoJsonFeature,
  rawFeatureIndex: number,
) => {
  const properties = rawFeature.properties ?? {};
  const poiId =
    typeof properties.wikidata === "string" ? properties.wikidata.trim() : "";
  if (!poiId) {
    throw new Error(`Raw feature ${rawFeatureIndex} has no wikidata id.`);
  }

  return poiId;
};

const findRawFeatureByPoiId = (poiId: string) => {
  const rawGeoJson = parseGeoJson(rawPath);
  const rawFeatures = rawGeoJson.features ?? [];
  const rawFeatureIndex = rawFeatures.findIndex((feature) => {
    const wikidata =
      typeof feature.properties?.wikidata === "string"
        ? feature.properties.wikidata.trim()
        : "";
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

const writeTransformedPoi = (
  rawFeature: GeoJsonFeature,
  rawFeatureIndex: number,
  rawGeoJson: GeoJson,
) => {
  const poiId = getPoiIdFromRawFeature(rawFeature, rawFeatureIndex);
  const transformedGeoJson = parseGeoJson(transformedPath);
  const properties = rawFeature.properties ?? {};
  const name =
    (typeof properties.name === "string" && properties.name.trim()) || poiId;
  const transformedFeature = transformRawPoiFeature(rawFeature, {
    poiId,
    contentSlug: toCitySlug(name),
  });
  const existingFeatures = transformedGeoJson.features ?? [];
  const existingFeatureIndex = existingFeatures.findIndex(
    (feature) => feature.wikidataId === poiId,
  );
  const nextFeatures =
    existingFeatureIndex >= 0
      ? existingFeatures.map((feature, index) =>
          index === existingFeatureIndex ? transformedFeature : feature,
        )
      : [...existingFeatures, transformedFeature];
  const nextGeoJson = {
    type: rawGeoJson.type ?? "FeatureCollection",
    generator: rawGeoJson.generator,
    copyright: rawGeoJson.copyright,
    timestamp: rawGeoJson.timestamp,
    features: nextFeatures,
  };

  writeFileSync(
    transformedPath,
    `${JSON.stringify(nextGeoJson, null, 2)}\n`,
    "utf-8",
  );
  return poiId;
};

const writeWikiSnapshot = async (poiId: string) => {
  console.info(`[wiki] Fetching Wikipedia text for ${poiId}.`);
  const inputPath = path.join(
    process.cwd(),
    "public",
    "data",
    `${toCitySlug(city)}-pois.geojson`,
  );
  const outputDir = getDefaultOutputDir();
  const poi = findPoiInGeoJson(inputPath, poiId, city);
  const outputFilePath = buildOutputFilePath(outputDir, poi.id);
  const resolved = await resolvePageForPoi(poi);
  const snapshot = await fetchWikiSnapshot(resolved.selected.title);

  writeSnapshotFile(outputFilePath, wikiTextToPlainText(snapshot.fullText));
  console.info(
    `[wiki] Saved readable Wikipedia text for ${poiId} to ${outputFilePath}.`,
  );
};

const writeMdxFile = async (poiId: string) => {
  console.info(`[wiki-mdx] Generating MDX for ${poiId}.`);
  const aiTextPath = buildOutputFilePath(aiDirectoryPath, poiId);
  if (!existsSync(aiTextPath)) {
    throw new Error(`AI text not found for ${poiId}.`);
  }

  const aiText = readFileSync(aiTextPath, "utf-8");
  if (aiText.trim().length === 0) {
    throw new Error(`Invalid AI text for ${poiId}.`);
  }

  const outputFilePath = path.join(
    mdxDirectoryPath,
    `${sanitizePoiIdForFile(poiId)}.mdx`,
  );
  writeFileSync(outputFilePath, plainTextToMdx(aiText), "utf-8");
  console.info(`[wiki-mdx] Saved MDX for ${poiId} to ${outputFilePath}.`);
};

const writeAiTextFile = async (poiId: string, aiModel: AiModel) => {
  console.info(
    `[wiki-ai] Generating AI text for ${poiId} with ${aiModel}.`,
  );
  const wikiTextPath = buildOutputFilePath(getDefaultOutputDir(), poiId);
  if (!existsSync(wikiTextPath)) {
    throw new Error(`Wiki text not found for ${poiId}.`);
  }

  const wikiText = readFileSync(wikiTextPath, "utf-8");
  if (wikiText.trim().length === 0) {
    throw new Error(`Invalid wiki text for ${poiId}.`);
  }

  const outputFilePath = buildOutputFilePath(aiDirectoryPath, poiId);
  mkdirSync(path.dirname(outputFilePath), { recursive: true });
  writeFileSync(
    outputFilePath,
    await enrichWikiText(wikiText, aiModel),
    "utf-8",
  );
  console.info(`[wiki-ai] Saved AI text for ${poiId} to ${outputFilePath}.`);
};

const refreshTransformedPoiPipeline = async (
  poiId: string,
  aiModel: AiModel,
) => {
  const { rawFeature, rawFeatureIndex, rawGeoJson } =
    findRawFeatureByPoiId(poiId);
  const refreshedPoiId = await measureGeneration(poiId, "transformed", () =>
    writeTransformedPoi(rawFeature, rawFeatureIndex, rawGeoJson),
  );
  await measureGeneration(refreshedPoiId, "wiki", () =>
    writeWikiSnapshot(refreshedPoiId),
  );
  await measureGeneration(refreshedPoiId, "ai", () =>
    writeAiTextFile(refreshedPoiId, aiModel),
    { aiModel },
  );
  await measureGeneration(refreshedPoiId, "mdx", () =>
    writeMdxFile(refreshedPoiId),
  );
};

const refreshWikiPipeline = async (poiId: string, aiModel: AiModel) => {
  await measureGeneration(poiId, "wiki", () => writeWikiSnapshot(poiId));
  await measureGeneration(
    poiId,
    "ai",
    () => writeAiTextFile(poiId, aiModel),
    { aiModel },
  );
  await measureGeneration(poiId, "mdx", () => writeMdxFile(poiId));
};

const refreshAiPipeline = async (poiId: string, aiModel: AiModel) => {
  await measureGeneration(
    poiId,
    "ai",
    () => writeAiTextFile(poiId, aiModel),
    { aiModel },
  );
  await measureGeneration(poiId, "mdx", () => writeMdxFile(poiId));
};

const deleteMdxFile = (poiId: string) => {
  const outputFilePath = path.join(
    mdxDirectoryPath,
    `${sanitizePoiIdForFile(poiId)}.mdx`,
  );
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

const deleteAiTextFile = (poiId: string) => {
  const outputFilePath = buildOutputFilePath(aiDirectoryPath, poiId);
  if (existsSync(outputFilePath)) {
    unlinkSync(outputFilePath);
  }
};

const deleteWikiPipeline = (poiId: string) => {
  deleteWikiSnapshotFile(poiId);
  deleteAiTextFile(poiId);
  deleteMdxFile(poiId);
  clearGenerationDurations(poiId, ["wiki", "ai", "mdx"]);
};

const deleteAiPipeline = (poiId: string) => {
  deleteAiTextFile(poiId);
  deleteMdxFile(poiId);
  clearGenerationDurations(poiId, ["ai", "mdx"]);
};

const deleteTransformedPoiPipeline = (poiId: string) => {
  const transformedGeoJson = parseGeoJson(transformedPath);
  const nextFeatures = (transformedGeoJson.features ?? []).filter(
    (feature) => feature.wikidataId !== poiId,
  );
  const nextGeoJson = {
    type: transformedGeoJson.type ?? "FeatureCollection",
    generator: transformedGeoJson.generator,
    copyright: transformedGeoJson.copyright,
    timestamp: transformedGeoJson.timestamp,
    features: nextFeatures,
  };

  writeFileSync(
    transformedPath,
    `${JSON.stringify(nextGeoJson, null, 2)}\n`,
    "utf-8",
  );
  deleteWikiPipeline(poiId);
  clearGenerationDurations(poiId, ["transformed"]);
};

export const generateSinglePoiJson = async (formData: FormData) => {
  const aiModel = await resolveAiModelFromFormData(formData);
  const rawFeatureIndex = Number(formData.get("rawFeatureIndex"));
  if (!Number.isInteger(rawFeatureIndex) || rawFeatureIndex < 0) {
    throw new Error("Invalid raw feature index.");
  }

  const rawGeoJson = parseGeoJson(rawPath);
  const rawFeature = rawGeoJson.features?.[rawFeatureIndex];

  if (!rawFeature) {
    throw new Error(`Raw feature ${rawFeatureIndex} not found.`);
  }

  const poiId = getPoiIdFromRawFeature(rawFeature, rawFeatureIndex);
  await measureGeneration(poiId, "transformed", () =>
    writeTransformedPoi(rawFeature, rawFeatureIndex, rawGeoJson),
  );
  await measureGeneration(poiId, "wiki", () => writeWikiSnapshot(poiId));
  await measureGeneration(
    poiId,
    "ai",
    () => writeAiTextFile(poiId, aiModel),
    { aiModel },
  );
  await measureGeneration(poiId, "mdx", () => writeMdxFile(poiId));
  revalidatePath("/admin");
};

export const refreshTransformedPoiJson = async (formData: FormData) => {
  const aiModel = await resolveAiModelFromFormData(formData);
  const poiId = formData.get("poiId");
  if (typeof poiId !== "string" || poiId.trim().length === 0) {
    throw new Error("Invalid POI id.");
  }

  await refreshTransformedPoiPipeline(poiId, aiModel);
  revalidatePath("/admin");
};

export const refreshWikiJson = async (formData: FormData) => {
  const aiModel = await resolveAiModelFromFormData(formData);
  const poiId = formData.get("poiId");
  if (typeof poiId !== "string" || poiId.trim().length === 0) {
    throw new Error("Invalid POI id.");
  }

  await refreshWikiPipeline(poiId, aiModel);
  revalidatePath("/admin");
};

export const refreshAiText = async (formData: FormData) => {
  const aiModel = await resolveAiModelFromFormData(formData);
  const poiId = formData.get("poiId");
  if (typeof poiId !== "string" || poiId.trim().length === 0) {
    throw new Error("Invalid POI id.");
  }

  await refreshAiPipeline(poiId, aiModel);
  revalidatePath("/admin");
};

export const refreshMdx = async (formData: FormData) => {
  const poiId = formData.get("poiId");
  if (typeof poiId !== "string" || poiId.trim().length === 0) {
    throw new Error("Invalid POI id.");
  }

  await measureGeneration(poiId, "mdx", () => writeMdxFile(poiId));
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

export const deleteAiText = async (formData: FormData) => {
  const poiId = formData.get("poiId");
  if (typeof poiId !== "string" || poiId.trim().length === 0) {
    throw new Error("Invalid POI id.");
  }

  deleteAiPipeline(poiId);
  revalidatePath("/admin");
};

export const deleteMdx = async (formData: FormData) => {
  const poiId = formData.get("poiId");
  if (typeof poiId !== "string" || poiId.trim().length === 0) {
    throw new Error("Invalid POI id.");
  }

  deleteMdxFile(poiId);
  clearGenerationDurations(poiId, ["mdx"]);
  revalidatePath("/admin");
};

export const saveMdx = async (formData: FormData) => {
  const poiId = formData.get("poiId");
  if (typeof poiId !== "string" || poiId.trim().length === 0) {
    throw new Error("Invalid POI id.");
  }

  const content = formData.get("content");
  if (typeof content !== "string") {
    throw new Error("Invalid MDX content.");
  }

  const outputFilePath = path.join(
    mdxDirectoryPath,
    `${sanitizePoiIdForFile(poiId)}.mdx`,
  );
  writeFileSync(outputFilePath, content, "utf-8");
  revalidatePath("/admin");
  revalidatePath("/rome");
};
