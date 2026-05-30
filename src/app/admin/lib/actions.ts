"use server";

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { extractWikipediaContent } from "@/server/wikiPipeline/extractWikipediaContent";
import { enrichWikiText } from "../../../../scripts/wiki/enrichWiki";
import {
  buildOutputFilePath,
  getDefaultInputPath,
  getDefaultOutputDir,
} from "../../../../scripts/wiki/io";
import {
  sanitizePoiIdForFile,
  toCitySlug,
} from "../../../../scripts/wiki/normalize";
import { transformRawPoiFeature } from "../../../../scripts/wiki/transformRawPoiFeature";
import {
  resolveAiSelection,
  type AiMode,
  type AiModel,
  type AiProvider,
  type AiSelection,
} from "./aiModels";

type GenerationStep = "transformed" | "wiki" | "ai";

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
const transformedPath = getDefaultInputPath(city);
const aiDirectoryPath = path.join(process.cwd(), "data", "wiki-ai");
const generationMetadataPath = path.join(
  process.cwd(),
  "data",
  "admin-generation-metadata.json",
);

const sanitizePoiNameForFile = (poiName: string) =>
  toCitySlug(poiName) || "unknown-name";

const buildAiMarkdownFileName = (poiId: string, poiName: string) =>
  `${sanitizePoiIdForFile(poiId)}--${sanitizePoiNameForFile(poiName)}.md`;

const buildAiMarkdownFilePath = (poiId: string, poiName: string) =>
  path.join(aiDirectoryPath, buildAiMarkdownFileName(poiId, poiName));

const buildLegacyAiTextFilePath = (poiId: string) =>
  buildOutputFilePath(aiDirectoryPath, poiId);

const getAiMarkdownFilePaths = (poiId: string) => {
  const normalizedPoiId = sanitizePoiIdForFile(poiId);
  if (!existsSync(aiDirectoryPath)) {
    return [] as string[];
  }

  return readdirSync(aiDirectoryPath)
    .filter(
      (fileName) =>
        fileName === `${normalizedPoiId}.md` ||
        (fileName.startsWith(`${normalizedPoiId}--`) &&
          fileName.endsWith(".md")),
    )
    .map((fileName) => path.join(aiDirectoryPath, fileName));
};

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

  mkdirSync(path.dirname(transformedPath), { recursive: true });
  writeFileSync(
    transformedPath,
    `${JSON.stringify(nextGeoJson, null, 2)}\n`,
    "utf-8",
  );
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
  const poiName =
    pickString(rawFeature.properties ?? {}, "name:en", "name", "int_name") ??
    poiId;
  const outputFilePath = buildAiMarkdownFilePath(poiId, poiName);
  mkdirSync(path.dirname(outputFilePath), { recursive: true });
  writeFileSync(
    outputFilePath,
    `# ${poiName} (${poiId})\n\n${(await enrichWikiText(wikiText, aiSelection)).trim()}\n`,
    "utf-8",
  );
  console.info(`[wiki-ai] Saved AI text for ${poiId} to ${outputFilePath}.`);
};

const refreshTransformedPoiPipeline = async (poiId: string) => {
  const { rawFeature, rawFeatureIndex, rawGeoJson } =
    findRawFeatureByPoiId(poiId);
  await measureGeneration(poiId, "transformed", () =>
    writeTransformedPoi(rawFeature, rawFeatureIndex, rawGeoJson),
  );
};

const refreshWikiPipeline = async (poiId: string) => {
  await measureGeneration(poiId, "wiki", () =>
    extractWikipediaContent({ city, poiId }),
  );
};

const refreshAiPipeline = async (poiId: string, aiSelection: AiSelection) => {
  await measureGeneration(
    poiId,
    "ai",
    () => writeAiTextFile(poiId, aiSelection),
    {
      aiMode: aiSelection.mode,
      aiProvider: aiSelection.provider,
      aiModel: aiSelection.model,
    },
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
    ...getAiMarkdownFilePaths(poiId),
    buildLegacyAiTextFilePath(poiId),
  ]) {
    if (existsSync(outputFilePath)) {
      unlinkSync(outputFilePath);
    }
  }
};

const deleteWikiPipeline = (poiId: string) => {
  deleteWikiSnapshotFile(poiId);
  deleteAiTextFile(poiId);
  clearGenerationDurations(poiId, ["wiki", "ai"]);
};

const deleteAiPipeline = (poiId: string) => {
  deleteAiTextFile(poiId);
  clearGenerationDurations(poiId, ["ai"]);
};

const deleteTransformedPoiPipeline = (poiId: string) => {
  if (!existsSync(transformedPath)) {
    deleteWikiPipeline(poiId);
    clearGenerationDurations(poiId, ["transformed"]);
    return;
  }

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

  mkdirSync(path.dirname(transformedPath), { recursive: true });
  writeFileSync(
    transformedPath,
    `${JSON.stringify(nextGeoJson, null, 2)}\n`,
    "utf-8",
  );
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

  const poiId = getPoiIdFromRawFeature(rawFeature, rawFeatureIndex);
  await measureGeneration(poiId, "transformed", () =>
    writeTransformedPoi(rawFeature, rawFeatureIndex, rawGeoJson),
  );
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
