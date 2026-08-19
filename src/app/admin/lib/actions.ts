"use server";

import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";
import {
  buildDraftStoryArtifactFilePath,
  buildLegacyDraftStoryArtifactFilePath,
  listDraftStoryArtifactFilePathsForPoi,
} from "@/server/storyWorkflow/draftStoryArtifacts";
import {
  buildMainImageCandidateArtifactFilePath,
  listMainImageCandidateArtifactFilePathsForPoi,
  readMainImageCandidateArtifact,
} from "@/server/storyWorkflow/mainImageCandidateArtifacts";
import { enrichWikiText } from "@/server/storyWorkflow/enrichWikiText";
import { fetchMainImageCandidates } from "@/server/storyWorkflow/mainImageCandidates";
import { extractWikipediaContent } from "@/server/wikiPipeline/extractWikipediaContent";
import {
  buildOutputFilePath,
  findPoiInGeoJson,
  getDefaultInputPath,
  getDefaultOutputDir,
} from "@/server/wikiPipeline/io";
import { sanitizePoiIdForFile, toCitySlug } from "@/server/wikiPipeline/normalize";
import { transformRawPoiFeature } from "@/server/wikiPipeline/transformRawPoiFeature";
import {
  resolveAiSelection,
  type AiMode,
  type AiModel,
  type AiProvider,
  type AiSelection,
} from "./aiModels";

type GenerationStep = "transformed" | "wiki" | "ai" | "image";

type GenerationMetadata = Record<
  string,
  Partial<
    Record<
      GenerationStep,
      {
        durationMs: number;
        completedAt: string;
        aiMode?: AiMode;
        aiProvider?: AiProvider;
        aiModel?: AiModel;
      }
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

const parseGeoJson = (filePath: string) => JSON.parse(readFileSync(filePath, "utf-8")) as GeoJson;

const city = "rome";
const rawPath = path.join(process.cwd(), "data", "rome", "pois", "raw.geojson");
const transformedPath = getDefaultInputPath(city);
const generationMetadataPath = path.join(process.cwd(), "data", "rome", "generation-metadata.json");

const pickString = (properties: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) {
    const value = properties[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
};

const readGenerationMetadata = () => {
  if (!existsSync(generationMetadataPath)) {
    return {} as GenerationMetadata;
  }

  return JSON.parse(readFileSync(generationMetadataPath, "utf-8")) as GenerationMetadata;
};

const writeGenerationMetadata = (metadata: GenerationMetadata) => {
  mkdirSync(path.dirname(generationMetadataPath), { recursive: true });
  writeFileSync(generationMetadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf-8");
};

const recordGenerationDuration = (
  poiId: string,
  step: GenerationStep,
  durationMs: number,
  extraMetadata?: {
    aiMode?: AiMode;
    aiProvider?: AiProvider;
    aiModel?: AiModel;
  },
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
  metadata?: {
    aiMode?: AiMode;
    aiProvider?: AiProvider;
    aiModel?: AiModel;
  },
) => {
  const startedAt = Date.now();
  const result = await action();
  recordGenerationDuration(poiId, step, Date.now() - startedAt, metadata);

  return result;
};

const getWikidataIdFromRawFeature = (rawFeature: GeoJsonFeature) => {
  const properties = rawFeature.properties ?? {};
  const wikidataId =
    typeof properties.wikidata === "string" ? properties.wikidata.trim() : "";

  return wikidataId || undefined;
};

const resolvePoiId = (poiId: string) => {
  if (!existsSync(transformedPath)) {
    return poiId;
  }

  const feature = (parseGeoJson(transformedPath).features ?? []).find(
    (item) => item.id === poiId || item.wikidataId === poiId,
  );

  return typeof feature?.id === "string" && feature.id.trim() ? feature.id : poiId;
};

const findRawFeatureByPoiId = (poiId: string) => {
  const poiGeoJson = parseGeoJson(transformedPath);
  const poiFeature = (poiGeoJson.features ?? []).find((feature) => feature.id === poiId);
  if (!poiFeature) {
    throw new Error(`POI ${poiId} not found.`);
  }

  const rawGeoJson = parseGeoJson(rawPath);
  const rawFeatures = rawGeoJson.features ?? [];
  const rawFeatureIndex = rawFeatures.findIndex((feature) => {
    const wikidataId = getWikidataIdFromRawFeature(feature);
    if (poiFeature.wikidataId && wikidataId) {
      return wikidataId === poiFeature.wikidataId;
    }

    const properties = feature.properties ?? {};
    return (
      toCitySlug(pickString(properties, "name:en", "name", "int_name") ?? "") === poiId
    );
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
  const transformedGeoJson = existsSync(transformedPath)
    ? parseGeoJson(transformedPath)
    : {
        type: rawGeoJson.type ?? "FeatureCollection",
        generator: rawGeoJson.generator,
        copyright: rawGeoJson.copyright,
        timestamp: rawGeoJson.timestamp,
        features: [],
      };
  const properties = rawFeature.properties ?? {};
  const wikidataId = getWikidataIdFromRawFeature(rawFeature);
  const existingFeatures = transformedGeoJson.features ?? [];
  const existingFeature = wikidataId
    ? existingFeatures.find((feature) => feature.wikidataId === wikidataId)
    : undefined;
  const basePoiId =
    toCitySlug(pickString(properties, "name:en", "name", "int_name") ?? "") ||
    `poi-${rawFeatureIndex + 1}`;
  let poiId =
    typeof existingFeature?.id === "string" && existingFeature.id.trim()
      ? existingFeature.id
      : basePoiId;
  let suffix = 2;
  while (existingFeatures.some((feature) => feature !== existingFeature && feature.id === poiId)) {
    poiId = `${basePoiId}-${suffix}`;
    suffix += 1;
  }
  const transformedFeature = transformRawPoiFeature(rawFeature, {
    poiId,
    wikidataId,
  });
  const existingFeatureIndex = existingFeature
    ? existingFeatures.indexOf(existingFeature)
    : -1;
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

  mkdirSync(path.dirname(transformedPath), { recursive: true });
  writeFileSync(transformedPath, `${JSON.stringify(nextGeoJson, null, 2)}\n`, "utf-8");
  return poiId;
};

const writeAiTextFile = async (poiId: string, aiSelection: AiSelection) => {
  console.info(
    `[wiki-ai] Generating AI text for ${poiId} with ${aiSelection.mode}/${aiSelection.provider}/${aiSelection.model}.`,
  );
  const wikiTextPath = buildOutputFilePath(getDefaultOutputDir(city), poiId);
  if (!existsSync(wikiTextPath)) {
    throw new Error(`Wiki text not found for ${poiId}.`);
  }

  const wikiText = readFileSync(wikiTextPath, "utf-8");
  if (wikiText.trim().length === 0) {
    throw new Error(`Invalid wiki text for ${poiId}.`);
  }

  const { rawFeature } = findRawFeatureByPoiId(poiId);
  const poiName = pickString(rawFeature.properties ?? {}, "name:en", "name", "int_name") ?? poiId;
  const outputFilePath = buildDraftStoryArtifactFilePath(poiId);
  mkdirSync(path.dirname(outputFilePath), { recursive: true });
  writeFileSync(
    outputFilePath,
    `# ${poiName} (${poiId})\n\n${(await enrichWikiText(wikiText, aiSelection)).trim()}\n`,
    "utf-8",
  );
  console.info(`[wiki-ai] Saved AI text for ${poiId} to ${outputFilePath}.`);
};

const writeMainImageCandidatesFile = async (poiId: string) => {
  console.info(`[wiki-images] Generating Main Image Candidates for ${poiId}.`);
  const previousArtifact = readMainImageCandidateArtifact(poiId);
  const candidates = await fetchMainImageCandidates(
    findPoiInGeoJson(getDefaultInputPath(city), poiId, city),
  );
  const selectableCandidates = candidates.filter(
    (candidate) => candidate.license && candidate.attribution,
  );
  const selectedCommonsFileName =
    candidates.find(
      (candidate) => candidate.commonsFileName === previousArtifact?.selectedCommonsFileName,
    )?.commonsFileName ??
    (selectableCandidates.length === 1 ? selectableCandidates[0]?.commonsFileName : undefined);
  const outputFilePath = buildMainImageCandidateArtifactFilePath(poiId);

  mkdirSync(path.dirname(outputFilePath), { recursive: true });
  for (const existingFilePath of listMainImageCandidateArtifactFilePathsForPoi(poiId)) {
    if (existingFilePath !== outputFilePath && existsSync(existingFilePath)) {
      unlinkSync(existingFilePath);
    }
  }
  writeFileSync(
    outputFilePath,
    `${JSON.stringify({ candidates, selectedCommonsFileName }, null, 2)}\n`,
    "utf-8",
  );
  console.info(
    `[wiki-images] Saved ${candidates.length} Main Image Candidates for ${poiId} to ${outputFilePath}.`,
  );
};

const refreshTransformedPoiPipeline = async (poiId: string) => {
  const resolvedPoiId = resolvePoiId(poiId);
  const { rawFeature, rawFeatureIndex, rawGeoJson } = findRawFeatureByPoiId(resolvedPoiId);
  await measureGeneration(resolvedPoiId, "transformed", () =>
    writeTransformedPoi(rawFeature, rawFeatureIndex, rawGeoJson),
  );
};

const refreshWikiPipeline = async (poiId: string) => {
  const resolvedPoiId = resolvePoiId(poiId);
  await measureGeneration(resolvedPoiId, "wiki", () =>
    extractWikipediaContent({ city, poiId: resolvedPoiId }),
  );
};

const refreshAiPipeline = async (poiId: string, aiSelection: AiSelection) => {
  const resolvedPoiId = resolvePoiId(poiId);
  await measureGeneration(resolvedPoiId, "ai", () => writeAiTextFile(resolvedPoiId, aiSelection), {
    aiMode: aiSelection.mode,
    aiProvider: aiSelection.provider,
    aiModel: aiSelection.model,
  });
};

const refreshMainImageCandidatesPipeline = async (poiId: string) => {
  const resolvedPoiId = resolvePoiId(poiId);
  await measureGeneration(resolvedPoiId, "image", () =>
    writeMainImageCandidatesFile(resolvedPoiId),
  );
};

const deleteWikiSnapshotFile = (poiId: string) => {
  const outputFilePath = buildOutputFilePath(getDefaultOutputDir(city), poiId);
  if (existsSync(outputFilePath)) {
    unlinkSync(outputFilePath);
  }
};

const deleteAiTextFile = (poiId: string) => {
  for (const outputFilePath of [
    ...listDraftStoryArtifactFilePathsForPoi(poiId),
    buildLegacyDraftStoryArtifactFilePath(poiId),
  ]) {
    if (existsSync(outputFilePath)) {
      unlinkSync(outputFilePath);
    }
  }
};

const deleteMainImageCandidatesFile = (poiId: string) => {
  for (const outputFilePath of listMainImageCandidateArtifactFilePathsForPoi(poiId)) {
    if (existsSync(outputFilePath)) {
      unlinkSync(outputFilePath);
    }
  }
};

const deleteWikiPipeline = (poiId: string) => {
  deleteWikiSnapshotFile(poiId);
  deleteAiTextFile(poiId);
  deleteMainImageCandidatesFile(poiId);
  clearGenerationDurations(poiId, ["wiki", "ai", "image"]);
};

const deleteAiPipeline = (poiId: string) => {
  deleteAiTextFile(poiId);
  clearGenerationDurations(poiId, ["ai"]);
};

const deleteMainImageCandidatesPipeline = (poiId: string) => {
  deleteMainImageCandidatesFile(poiId);
  clearGenerationDurations(poiId, ["image"]);
};

const deleteTransformedPoiPipeline = (poiId: string) => {
  if (!existsSync(transformedPath)) {
    deleteWikiPipeline(poiId);
    clearGenerationDurations(poiId, ["transformed"]);
    return;
  }

  const transformedGeoJson = parseGeoJson(transformedPath);
  const nextFeatures = (transformedGeoJson.features ?? []).filter(
    (feature) => feature.id !== poiId,
  );
  const nextGeoJson = {
    type: transformedGeoJson.type ?? "FeatureCollection",
    generator: transformedGeoJson.generator,
    copyright: transformedGeoJson.copyright,
    timestamp: transformedGeoJson.timestamp,
    features: nextFeatures,
  };

  mkdirSync(path.dirname(transformedPath), { recursive: true });
  writeFileSync(transformedPath, `${JSON.stringify(nextGeoJson, null, 2)}\n`, "utf-8");
  deleteWikiPipeline(poiId);
  clearGenerationDurations(poiId, ["transformed"]);
};

export const generateTransformedPoiJson = async (formData: FormData) => {
  const rawFeatureIndex = Number(formData.get("rawFeatureIndex"));
  if (!Number.isInteger(rawFeatureIndex) || rawFeatureIndex < 0) {
    throw new Error("Invalid raw feature index.");
  }

  const rawGeoJson = parseGeoJson(rawPath);
  const rawFeature = rawGeoJson.features?.[rawFeatureIndex];

  if (!rawFeature) {
    throw new Error(`Raw feature ${rawFeatureIndex} not found.`);
  }

  const startedAt = Date.now();
  const poiId = writeTransformedPoi(rawFeature, rawFeatureIndex, rawGeoJson);
  recordGenerationDuration(poiId, "transformed", Date.now() - startedAt);
};

export const refreshTransformedPoiJson = async (formData: FormData) => {
  const poiId = formData.get("poiId");
  if (typeof poiId !== "string" || poiId.trim().length === 0) {
    throw new Error("Invalid POI id.");
  }

  await refreshTransformedPoiPipeline(poiId);
};

export const refreshWikiJson = async (formData: FormData) => {
  const poiId = formData.get("poiId");
  if (typeof poiId !== "string" || poiId.trim().length === 0) {
    throw new Error("Invalid POI id.");
  }

  await refreshWikiPipeline(poiId);
};

export const refreshAiText = async (formData: FormData) => {
  const aiSelection = await resolveAiSelection(formData);
  const poiId = formData.get("poiId");
  if (typeof poiId !== "string" || poiId.trim().length === 0) {
    throw new Error("Invalid POI id.");
  }

  await refreshAiPipeline(poiId, aiSelection);
  revalidatePath("/admin");
};

export const refreshMainImageCandidates = async (formData: FormData) => {
  const poiId = formData.get("poiId");
  if (typeof poiId !== "string" || poiId.trim().length === 0) {
    throw new Error("Invalid POI id.");
  }

  await refreshMainImageCandidatesPipeline(poiId);
  revalidatePath("/admin");
};

export const selectMainImageCandidate = async (formData: FormData) => {
  const poiId = formData.get("poiId");
  const commonsFileName = formData.get("commonsFileName");
  if (typeof poiId !== "string" || poiId.trim().length === 0) {
    throw new Error("Invalid POI id.");
  }

  if (typeof commonsFileName !== "string" || commonsFileName.trim().length === 0) {
    throw new Error("Invalid Commons file name.");
  }

  const artifact = readMainImageCandidateArtifact(poiId);
  const candidate = artifact?.candidates.find((item) => item.commonsFileName === commonsFileName);
  if (!artifact || !candidate) {
    throw new Error(`Main Image Candidate ${commonsFileName} not found.`);
  }

  if (!candidate.license || !candidate.attribution) {
    throw new Error(`Main Image Candidate ${commonsFileName} is missing license or attribution.`);
  }

  const [filePath] = listMainImageCandidateArtifactFilePathsForPoi(poiId);
  if (!filePath) {
    throw new Error(`Main Image Candidates for ${poiId} not found.`);
  }

  writeFileSync(
    filePath,
    `${JSON.stringify(
      {
        ...artifact,
        selectedCommonsFileName: candidate.commonsFileName,
      },
      null,
      2,
    )}\n`,
    "utf-8",
  );
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

export const deleteMainImageCandidates = async (formData: FormData) => {
  const poiId = formData.get("poiId");
  if (typeof poiId !== "string" || poiId.trim().length === 0) {
    throw new Error("Invalid POI id.");
  }

  deleteMainImageCandidatesPipeline(poiId);
  revalidatePath("/admin");
};
