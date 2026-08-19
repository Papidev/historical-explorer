import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { listDraftStoryArtifactFiles } from "@/server/storyWorkflow/draftStoryArtifacts";
import { listMainImageCandidateArtifactFiles } from "@/server/storyWorkflow/mainImageCandidateArtifacts";
import { getDefaultInputPath, getDefaultOutputDir } from "@/server/wikiPipeline/io";
import type {
  AdminPoiRow,
  GeoJson,
  GeoJsonFeature,
  MainImageCandidatesArtifact,
  PoiItem,
} from "./types";

type GenerationStep = "transformed" | "wiki" | "ai" | "image";

type GenerationMetadata = Record<
  string,
  Partial<
    Record<
      GenerationStep,
      {
        durationMs: number;
        aiMode?: string;
        aiProvider?: string;
        aiModel?: string;
      }
    >
  >
>;

const toRowKey = (value: string) => value.trim().toLowerCase();

const parseGeoJson = (filePath: string) => {
  const raw = readFileSync(filePath, "utf-8");

  return JSON.parse(raw) as GeoJson;
};

const formatUpdatedAt = (filePath: string) =>
  new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(statSync(filePath).mtime);

const formatDuration = (durationMs: number) => {
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  if (durationMs < 60_000) {
    return `${(durationMs / 1000).toFixed(1)}s`;
  }

  const minutes = Math.floor(durationMs / 60_000);
  const seconds = Math.round((durationMs % 60_000) / 1000);

  return `${minutes}m ${seconds}s`;
};

const loadGenerationMetadata = (filePath: string) => {
  if (!existsSync(filePath)) {
    return {} as GenerationMetadata;
  }

  return JSON.parse(readFileSync(filePath, "utf-8")) as GenerationMetadata;
};

const toPoiItems = (features: GeoJsonFeature[] | undefined) =>
  (features ?? []).map((feature, index) => {
    const properties = feature.properties ?? {};
    const id =
      (typeof feature.wikidataId === "string" && feature.wikidataId.trim()) ||
      (typeof properties.wikidata === "string" && properties.wikidata.trim()) ||
      (typeof feature.id === "string" && feature.id.trim()) ||
      (typeof feature.id === "number" ? `${feature.id}` : "") ||
      `missing-id-${index}`;
    const name = (typeof properties.name === "string" && properties.name.trim()) || id;
    const wikidata =
      typeof properties.wikidata === "string" ? properties.wikidata.trim() : undefined;

    return { id, name, wikidata, featureIndex: index } satisfies PoiItem;
  });

const loadWikiSnapshots = (directoryPath: string) =>
  (existsSync(directoryPath) ? readdirSync(directoryPath) : [])
    .filter((fileName) => fileName.endsWith(".txt"))
    .sort()
    .map((fileName, index) => {
      const filePath = path.join(directoryPath, fileName);
      const raw = readFileSync(filePath, "utf-8");
      const id = fileName.replace(/\.txt$/u, "") || `missing-id-${index}`;

      return {
        item: { id, name: `${id}.txt`, featureIndex: index } satisfies PoiItem,
        json: raw,
        updatedAt: formatUpdatedAt(filePath),
      };
    });

const loadAiMarkdownFiles = () =>
  listDraftStoryArtifactFiles().map(({ fileName, filePath, poiId }, index) => {
    const raw = readFileSync(filePath, "utf-8");

    return {
      item: {
        id: poiId || `missing-id-${index}`,
        name: fileName,
        featureIndex: index,
      } satisfies PoiItem,
      json: raw,
      updatedAt: formatUpdatedAt(filePath),
    };
  });

const loadMainImageCandidateFiles = () =>
  listMainImageCandidateArtifactFiles().map(({ fileName, filePath, poiId }, index) => {
    const raw = readFileSync(filePath, "utf-8");

    return {
      item: {
        id: poiId || `missing-id-${index}`,
        name: fileName,
        featureIndex: index,
      } satisfies PoiItem,
      artifact: JSON.parse(raw) as MainImageCandidatesArtifact,
      updatedAt: formatUpdatedAt(filePath),
    };
  });

const toPoiRows = (
  rawPois: PoiItem[],
  rawUpdatedAt: string,
  generationMetadata: GenerationMetadata,
  transformedPois: Array<{ item: PoiItem; json: string; updatedAt: string }>,
  wikiPois: Array<{ item: PoiItem; json: string; updatedAt: string }>,
  aiPois: Array<{ item: PoiItem; json: string; updatedAt: string }>,
  mainImagePois: Array<{
    item: PoiItem;
    artifact: MainImageCandidatesArtifact;
    updatedAt: string;
  }>,
) => {
  const rowsById = new Map<string, AdminPoiRow>();

  for (const rawPoi of rawPois) {
    rowsById.set(toRowKey(rawPoi.id), { id: rawPoi.id, rawPoi, rawUpdatedAt });
  }

  for (const { item, json, updatedAt } of transformedPois) {
    const rowKey = toRowKey(item.id);
    const row = rowsById.get(rowKey);
    rowsById.set(
      rowKey,
      row
        ? {
            ...row,
            transformedPoi: item,
            transformedJson: json,
            transformedUpdatedAt: updatedAt,
            transformedGenerationDuration: generationMetadata[rowKey]?.transformed
              ? formatDuration(generationMetadata[rowKey].transformed.durationMs)
              : undefined,
          }
        : {
            id: item.id,
            transformedPoi: item,
            transformedJson: json,
            transformedUpdatedAt: updatedAt,
            transformedGenerationDuration: generationMetadata[rowKey]?.transformed
              ? formatDuration(generationMetadata[rowKey].transformed.durationMs)
              : undefined,
          },
    );
  }

  for (const { item, json, updatedAt } of wikiPois) {
    const rowKey = toRowKey(item.id);
    const row = rowsById.get(rowKey);
    rowsById.set(
      rowKey,
      row
        ? {
            ...row,
            wikiPoi: item,
            wikiText: json,
            wikiUpdatedAt: updatedAt,
            wikiGenerationDuration: generationMetadata[rowKey]?.wiki
              ? formatDuration(generationMetadata[rowKey].wiki.durationMs)
              : undefined,
          }
        : {
            id: item.id,
            wikiPoi: item,
            wikiText: json,
            wikiUpdatedAt: updatedAt,
            wikiGenerationDuration: generationMetadata[rowKey]?.wiki
              ? formatDuration(generationMetadata[rowKey].wiki.durationMs)
              : undefined,
          },
    );
  }

  for (const { item, json, updatedAt } of aiPois) {
    const rowKey = toRowKey(item.id);
    const row = rowsById.get(rowKey);
    rowsById.set(
      rowKey,
      row
        ? {
            ...row,
            aiPoi: item,
            aiText: json,
            aiUpdatedAt: updatedAt,
            aiGenerationDuration: generationMetadata[rowKey]?.ai
              ? formatDuration(generationMetadata[rowKey].ai.durationMs)
              : undefined,
            aiGenerationModel: generationMetadata[rowKey]?.ai?.aiModel,
            aiGenerationProvider: generationMetadata[rowKey]?.ai?.aiProvider,
            aiGenerationMode: generationMetadata[rowKey]?.ai?.aiMode,
          }
        : {
            id: item.id,
            aiPoi: item,
            aiText: json,
            aiUpdatedAt: updatedAt,
            aiGenerationDuration: generationMetadata[rowKey]?.ai
              ? formatDuration(generationMetadata[rowKey].ai.durationMs)
              : undefined,
            aiGenerationModel: generationMetadata[rowKey]?.ai?.aiModel,
            aiGenerationProvider: generationMetadata[rowKey]?.ai?.aiProvider,
            aiGenerationMode: generationMetadata[rowKey]?.ai?.aiMode,
          },
    );
  }

  for (const { item, artifact, updatedAt } of mainImagePois) {
    const rowKey = toRowKey(item.id);
    const row = rowsById.get(rowKey);
    rowsById.set(
      rowKey,
      row
        ? {
            ...row,
            mainImagePoi: item,
            mainImageArtifact: artifact,
            mainImageUpdatedAt: updatedAt,
            mainImageGenerationDuration: generationMetadata[rowKey]?.image
              ? formatDuration(generationMetadata[rowKey].image.durationMs)
              : undefined,
          }
        : {
            id: item.id,
            mainImagePoi: item,
            mainImageArtifact: artifact,
            mainImageUpdatedAt: updatedAt,
            mainImageGenerationDuration: generationMetadata[rowKey]?.image
              ? formatDuration(generationMetadata[rowKey].image.durationMs)
              : undefined,
          },
    );
  }

  return Array.from(rowsById.values()).sort((left, right) => {
    const leftGeneratedCount = [
      left.transformedPoi,
      left.wikiPoi,
      left.aiPoi,
      left.mainImagePoi,
    ].filter(Boolean).length;
    const rightGeneratedCount = [
      right.transformedPoi,
      right.wikiPoi,
      right.aiPoi,
      right.mainImagePoi,
    ].filter(Boolean).length;

    return rightGeneratedCount - leftGeneratedCount;
  });
};

export const loadPoiLists = async () => {
  try {
    const rawPath = path.join(process.cwd(), "data", "rome", "raw", "pois.geojson");
    const transformedPath = getDefaultInputPath("rome");
    const wikiDirectoryPath = getDefaultOutputDir("rome");
    const generationMetadataPath = path.join(
      process.cwd(),
      "data",
      "rome",
      "generation-metadata.json",
    );
    const rawUpdatedAt = formatUpdatedAt(rawPath);
    const transformedUpdatedAt = existsSync(transformedPath)
      ? formatUpdatedAt(transformedPath)
      : undefined;
    const generationMetadata = loadGenerationMetadata(generationMetadataPath);

    const rawPois = toPoiItems(parseGeoJson(rawPath).features);
    const transformedGeoJson = existsSync(transformedPath)
      ? parseGeoJson(transformedPath)
      : ({ features: [] } as GeoJson);
    const transformedPois = (transformedGeoJson.features ?? []).map((feature, index) => ({
      item: toPoiItems([feature])[0] ?? {
        id: `missing-id-${index}`,
        name: `missing-id-${index}`,
        featureIndex: index,
      },
      json: JSON.stringify(feature, null, 2),
      updatedAt: transformedUpdatedAt ?? "",
    }));
    const wikiPois = loadWikiSnapshots(wikiDirectoryPath);
    const aiPois = loadAiMarkdownFiles();
    const mainImagePois = loadMainImageCandidateFiles();
    const rows = toPoiRows(
      rawPois,
      rawUpdatedAt,
      generationMetadata,
      transformedPois,
      wikiPois,
      aiPois,
      mainImagePois,
    );

    return { rows, error: null };
  } catch (error) {
    return {
      rows: [] as AdminPoiRow[],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};
