import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { storyWorkflow, type DraftStorySnapshot } from "@/server/storyWorkflow";
import { getDefaultInputPath } from "@/server/wikiPipeline/io";
import type {
  AdminPoiRow,
  GeoJson,
  GeoJsonFeature,
  MainImageCandidatesArtifact,
  PoiItem,
} from "./types";

type GenerationStep = "transformed" | "wiki" | "storyContent" | "image";

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

const formatCompletedAt = (completedAt?: string) =>
  completedAt
    ? new Intl.DateTimeFormat("it-IT", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(completedAt))
    : "";

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

const toPoiItems = (features: GeoJsonFeature[] | undefined, raw = false) =>
  (features ?? []).map((feature, index) => {
    const properties = feature.properties ?? {};
    const wikidata =
      (typeof feature.wikidataId === "string" && feature.wikidataId.trim()) ||
      (typeof properties.wikidata === "string" && properties.wikidata.trim()) ||
      undefined;
    const id =
      (raw ? wikidata : undefined) ||
      (typeof feature.id === "string" && feature.id.trim()) ||
      (typeof feature.id === "number" ? `${feature.id}` : "") ||
      wikidata ||
      `missing-id-${index}`;
    const name = (typeof properties.name === "string" && properties.name.trim()) || id;

    return { id, name, wikidata, featureIndex: index } satisfies PoiItem;
  });

const toSnapshotItem = (snapshot: DraftStorySnapshot, index: number) => ({
  id: snapshot.poiId,
  name: snapshot.poiId,
  featureIndex: index,
});

const toPoiRows = (
  rawPois: PoiItem[],
  rawUpdatedAt: string,
  generationMetadata: GenerationMetadata,
  transformedPois: Array<{ item: PoiItem; json: string; updatedAt: string }>,
  wikiPois: Array<{ item: PoiItem; json: string; updatedAt: string }>,
  storyContentPois: Array<{
    item: PoiItem;
    storyContent: NonNullable<DraftStorySnapshot["storyContent"]>;
    sources: DraftStorySnapshot["sources"];
    updatedAt: string;
  }>,
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
    const rawRowEntry = item.wikidata
      ? Array.from(rowsById.entries()).find(
          ([, candidate]) => candidate.rawPoi?.wikidata === item.wikidata,
        )
      : undefined;
    const row = rowsById.get(rowKey) ?? rawRowEntry?.[1];
    if (rawRowEntry && rawRowEntry[0] !== rowKey) {
      rowsById.delete(rawRowEntry[0]);
    }
    rowsById.set(
      rowKey,
      row
        ? {
            ...row,
            id: item.id,
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

  for (const { item, storyContent, sources, updatedAt } of storyContentPois) {
    const rowKey = toRowKey(item.id);
    const row = rowsById.get(rowKey);
    rowsById.set(rowKey, {
      ...row,
      id: item.id,
      storyContent,
      storyContentSources: sources,
      storyContentUpdatedAt: updatedAt,
      storyContentGenerationDuration: generationMetadata[rowKey]?.storyContent
        ? formatDuration(generationMetadata[rowKey].storyContent.durationMs)
        : undefined,
      storyContentGenerationMode: generationMetadata[rowKey]?.storyContent?.aiMode,
      storyContentGenerationProvider: generationMetadata[rowKey]?.storyContent?.aiProvider,
      storyContentGenerationModel: generationMetadata[rowKey]?.storyContent?.aiModel,
    });
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
      left.storyContent,
      left.mainImagePoi,
    ].filter(Boolean).length;
    const rightGeneratedCount = [
      right.transformedPoi,
      right.wikiPoi,
      right.storyContent,
      right.mainImagePoi,
    ].filter(Boolean).length;

    return rightGeneratedCount - leftGeneratedCount;
  });
};

export const loadPoiLists = async () => {
  try {
    const rawPath = path.join(process.cwd(), "data", "rome", "pois", "raw.geojson");
    const transformedPath = getDefaultInputPath("rome");
    const generationMetadataPath = path.join(
      process.cwd(),
      "data",
      "rome",
      "generated",
      "generation-metadata.json",
    );
    const rawUpdatedAt = formatUpdatedAt(rawPath);
    const transformedUpdatedAt = existsSync(transformedPath)
      ? formatUpdatedAt(transformedPath)
      : undefined;
    const generationMetadata = loadGenerationMetadata(generationMetadataPath);

    const rawPois = toPoiItems(parseGeoJson(rawPath).features, true);
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
    const snapshots = (
      await Promise.all(
        transformedPois.map(({ item }) => storyWorkflow.draftStory.get({ poiId: item.id })),
      )
    ).filter((snapshot): snapshot is DraftStorySnapshot => Boolean(snapshot));
    const wikiPois = snapshots
      .filter((snapshot) => snapshot.sources.length > 0)
      .map((snapshot, index) => ({
        item: toSnapshotItem(snapshot, index),
        json: snapshot.sources.map((source) => source.content).join("\n\n"),
        updatedAt: formatCompletedAt(snapshot.generation.sources?.completedAt),
      }));
    const storyContentPois = snapshots
      .filter(
        (
          snapshot,
        ): snapshot is DraftStorySnapshot & {
          storyContent: NonNullable<DraftStorySnapshot["storyContent"]>;
        } => Boolean(snapshot.storyContent),
      )
      .map((snapshot, index) => ({
        item: toSnapshotItem(snapshot, index),
        storyContent: snapshot.storyContent,
        sources: snapshot.sources,
        updatedAt: formatCompletedAt(snapshot.generation.storyContent?.completedAt),
      }));
    const mainImagePois = snapshots
      .filter(
        (snapshot) =>
          snapshot.mainImageCandidates.length > 0 || snapshot.generation.mainImageCandidates,
      )
      .map((snapshot, index) => ({
        item: toSnapshotItem(snapshot, index),
        artifact: {
          candidates: snapshot.mainImageCandidates,
          selectedCommonsFileName: snapshot.draftMainImage?.commonsFileName,
        },
        updatedAt: formatCompletedAt(snapshot.generation.mainImageCandidates?.completedAt),
      }));
    const rows = toPoiRows(
      rawPois,
      rawUpdatedAt,
      generationMetadata,
      transformedPois,
      wikiPois,
      storyContentPois,
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
