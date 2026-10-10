import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { readGenerationMetadata, type GenerationMetadata } from "@/server/generationMetadata";
import { readGenerationRuns } from "@/server/generationRunLog";
import { storyWorkflow, type DraftStorySnapshot } from "@/server/storyWorkflow";
import { personRepository } from "@/server/person/filesystemRepository";
import { getSourceLinkIssue } from "@/server/person";
import { getPoiGeoPlaceId } from "@/server/pointOfInterest/getPoiGeoPlaceId";
import { getFeatureId } from "@/server/wikiPipeline/normalize";
import { sanitizePoiIdForFile } from "@/server/wikiPipeline/normalize";
import { poiTypes } from "@/server/poiTypes";
import {
  buildSourceMetadataFilePath,
  getDefaultInputPath,
  getDefaultOutputDir,
} from "@/server/wikiPipeline/io";
import type {
  AdminArtifact,
  AdminPoiRow,
  GeoJson,
  GeoJsonFeature,
  MainImageCandidatesArtifact,
  PoiItem,
} from "./types";
import { getCurrentGenerationErrors } from "./getCurrentGenerationErrors";
import { getPoiRowStatusGroup } from "./getPoiRowStatusGroup";

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

const readArtifact = ({
  label,
  relativePath,
  versioned,
}: {
  label: string;
  relativePath: string;
  versioned: boolean;
}): AdminArtifact | undefined => {
  const filePath = path.join(process.cwd(), "data", relativePath);
  return existsSync(filePath)
    ? {
        label,
        path: `data/${relativePath}`,
        content: readFileSync(filePath, "utf-8"),
        versioned,
      }
    : undefined;
};

export const toPoiItems = (
  features: GeoJsonFeature[] | undefined,
  raw = false,
  geoPlaces: GeoJsonFeature[] = [],
) =>
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

    return {
      id,
      name,
      wikidata,
      geoPlaceId: raw
        ? getFeatureId(feature, `missing-id-${index}`)
        : getPoiGeoPlaceId(feature, geoPlaces),
      featureIndex: index,
    } satisfies PoiItem;
  });

const toSnapshotItem = (snapshot: DraftStorySnapshot, index: number) => ({
  id: snapshot.poiId,
  name: snapshot.poiId,
  featureIndex: index,
});

export const toPoiRows = (
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
  const duplicatePoiIds = new Set<string>();

  for (const rawPoi of rawPois) {
    rowsById.set(toRowKey(rawPoi.id), { id: rawPoi.id, rawPoi, rawUpdatedAt });
  }

  for (const { item, json, updatedAt } of transformedPois) {
    const rowKey = toRowKey(item.id);
    // Keep one table row per source, including legacy catalog duplicates.
    if (
      item.geoPlaceId &&
      Array.from(rowsById.values()).some(
        (row) => row.transformedPoi?.geoPlaceId === item.geoPlaceId,
      )
    ) {
      duplicatePoiIds.add(item.id);
      continue;
    }
    const rawRowEntry = Array.from(rowsById.entries()).find(
      ([, candidate]) =>
        (item.geoPlaceId && candidate.rawPoi?.geoPlaceId === item.geoPlaceId) ||
        (item.wikidata && candidate.rawPoi?.wikidata === item.wikidata),
    );
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
    if (duplicatePoiIds.has(item.id)) continue;
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
    if (duplicatePoiIds.has(item.id)) continue;
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
      relatedPeopleUpdatedAt: formatCompletedAt(
        generationMetadata[rowKey]?.relatedPeople?.completedAt,
      ),
      relatedPeopleGenerationDuration: generationMetadata[rowKey]?.relatedPeople
        ? formatDuration(generationMetadata[rowKey].relatedPeople.durationMs)
        : undefined,
      storyContentGenerationMode: generationMetadata[rowKey]?.storyContent?.aiMode,
      storyContentGenerationProvider: generationMetadata[rowKey]?.storyContent?.aiProvider,
      storyContentGenerationModel: generationMetadata[rowKey]?.storyContent?.aiModel,
    });
  }

  for (const { item, artifact, updatedAt } of mainImagePois) {
    if (duplicatePoiIds.has(item.id)) continue;
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

  return Array.from(rowsById.values());
};

export const loadPoiLists = async () => {
  try {
    const rawPath = path.join(process.cwd(), "data", "rome", "pois", "raw.geojson");
    const transformedPath = getDefaultInputPath("rome");
    const rawUpdatedAt = formatUpdatedAt(rawPath);
    const rawContent = readFileSync(rawPath, "utf-8");
    const transformedUpdatedAt = existsSync(transformedPath)
      ? formatUpdatedAt(transformedPath)
      : undefined;
    const generationMetadata = readGenerationMetadata("rome");
    const generationRuns = readGenerationRuns(process.cwd(), "rome");
    const globalArtifacts: AdminArtifact[] = [];

    const rawGeoJson = JSON.parse(rawContent) as GeoJson;
    const rawPois = toPoiItems(rawGeoJson.features, true);
    const transformedGeoJson = existsSync(transformedPath)
      ? parseGeoJson(transformedPath)
      : ({ features: [] } as GeoJson);
    const transformedPois = (transformedGeoJson.features ?? []).map((feature, index) => ({
      item: toPoiItems([feature], false, rawGeoJson.features)[0] ?? {
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
        storyContent: {
          ...snapshot.storyContent,
          relatedPeople: snapshot.storyContent.relatedPeople.map((person) =>
            person.personId && personRepository.get(person.personId)
              ? person
              : { name: person.name, sourceIds: person.sourceIds },
          ),
        },
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
    ).map((row) => {
      const rawFeature = rawGeoJson.features?.[row.rawPoi?.featureIndex ?? -1];
      const matchingRuns = generationRuns.filter(
        (run) =>
          (run.poiId && run.poiId === row.id) ||
          (run.geoPlaceId && run.geoPlaceId === row.rawPoi?.id),
      );
      const [lastRun] = matchingRuns;
      const latestDraftRun = matchingRuns.find(
        (run) => run.operation === "draftStory.generate" && run.event !== "started",
      );
      const types = row.transformedPoi ? poiTypes.get(row.id) : undefined;
      const poiTypesPath = path.join(
        process.cwd(),
        "data",
        "rome",
        "generated",
        "wikidata",
        `${sanitizePoiIdForFile(row.id)}.json`,
      );
      const generationErrors = getCurrentGenerationErrors(matchingRuns, {
        ...generationMetadata[toRowKey(row.id)],
        ...(types && !types.error && existsSync(poiTypesPath)
          ? { poiTypes: { completedAt: statSync(poiTypesPath).mtime.toISOString() } }
          : {}),
      });
      const sourcePending =
        generationMetadata[toRowKey(row.id)]?.sourceMissing ||
        (generationErrors.some(
          ({ at, stage }) => at === latestDraftRun?.at && stage === "sources",
        ) &&
          (latestDraftRun?.errorCode === "source-not-found" ||
            (latestDraftRun?.errorCode === "sources-unavailable" &&
              latestDraftRun.errorMessage?.includes(
                "no valid English Wikipedia tag or Wikidata English sitelink",
              ))));
      return {
        ...row,
        sourcePending,
        poiTypes: types,
        ...(sourcePending
          ? {
              wikiPoi: undefined,
              wikiText: undefined,
              wikiUpdatedAt: undefined,
              wikiGenerationDuration: undefined,
              storyContent: undefined,
              storyContentSources: undefined,
              storyContentUpdatedAt: undefined,
              storyContentGenerationDuration: undefined,
              mainImagePoi: undefined,
              mainImageArtifact: undefined,
              mainImageUpdatedAt: undefined,
              mainImageGenerationDuration: undefined,
              relatedPeopleUpdatedAt: undefined,
              relatedPeopleGenerationDuration: undefined,
            }
          : {}),
        generationErrors: generationErrors.map((error) => ({
          ...error,
          at: formatCompletedAt(error.at),
        })),
        lastGenerationRun: lastRun
          ? {
              operation: lastRun.operation,
              status:
                lastRun.event === "failed"
                  ? lastRun === latestDraftRun && sourcePending
                    ? "needs-source"
                    : "failed"
                  : lastRun.event === "started"
                    ? "incomplete"
                    : (lastRun.status ?? "success"),
              at: formatCompletedAt(lastRun.at),
            }
          : undefined,
        artifacts: {
          geoPlace: rawFeature
            ? {
                label: "Geo Place JSON",
                path: `data/rome/pois/raw.geojson#${row.id}`,
                content: JSON.stringify(rawFeature, null, 2),
                versioned: true,
              }
            : undefined,
          wikipediaMetadata: sourcePending
            ? undefined
            : readArtifact({
                label: "Wikipedia Source Metadata",
                relativePath: path.relative(
                  path.join(process.cwd(), "data"),
                  buildSourceMetadataFilePath(getDefaultOutputDir("rome"), row.id),
                ),
                versioned: false,
              }),
          storyContent: sourcePending
            ? undefined
            : readArtifact({
                label: "Story JSON",
                relativePath: `rome/stories/${row.id}/story.json`,
                versioned: true,
              }),
          mainImageCandidates: sourcePending
            ? undefined
            : readArtifact({
                label: "Main Image Candidates JSON",
                relativePath: `rome/stories/${row.id}/images.json`,
                versioned: true,
              }),
          relatedPeople: (sourcePending ? [] : (row.storyContent?.relatedPeople ?? [])).map(
            ({ name, personId }) => ({
              name,
              personId,
              resolutionError: !personId
                ? (generationMetadata[toRowKey(row.id)]?.relatedPeople?.relatedPeopleFailures?.find(
                    (failure) => failure.name === name,
                  )?.message ?? getSourceLinkIssue(name, row.storyContentSources ?? []))
                : undefined,
              artifacts: personId
                ? [
                    readArtifact({
                      label: `${name} Person JSON`,
                      relativePath: `people/${personId}/person.json`,
                      versioned: true,
                    }),
                    readArtifact({
                      label: `${name} Wikipedia Text`,
                      relativePath: `generated/people/${personId}.txt`,
                      versioned: false,
                    }),
                  ].filter((artifact): artifact is AdminArtifact => Boolean(artifact))
                : [],
            }),
          ),
        },
      } satisfies AdminPoiRow;
    });

    for (const row of rows) {
      row.wikidataId = row.transformedPoi?.wikidata ?? row.rawPoi?.wikidata;
    }

    const priority = (row: AdminPoiRow) =>
      ({ "needs-attention": 0, "to-do": 1, complete: 2, "needs-source": 3 })[
        getPoiRowStatusGroup(row)
      ];
    rows.sort(
      (left, right) =>
        priority(left) - priority(right) ||
        (left.rawPoi?.name ?? left.transformedPoi?.name ?? left.id).localeCompare(
          right.rawPoi?.name ?? right.transformedPoi?.name ?? right.id,
          "it",
          { sensitivity: "base" },
        ),
    );

    return { rows, globalArtifacts, error: null };
  } catch (error) {
    return {
      rows: [] as AdminPoiRow[],
      globalArtifacts: [] as AdminArtifact[],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};
