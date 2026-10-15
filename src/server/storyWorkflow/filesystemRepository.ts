import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import {
  deleteGenerationCheckpoints,
  markSourceMissing,
  readGenerationMetadata,
  replaceGenerationCheckpoint,
} from "@/server/generationMetadata";
import {
  buildMainImageCandidateArtifactFilePath,
  readMainImageCandidateArtifact,
} from "./mainImageCandidateArtifacts";
import { buildStoryContentFilePath, readStoryContent } from "./storyContentArtifacts";
import type { StoryWorkflowRepository } from "./createStoryWorkflow";
import {
  buildOutputFilePath,
  buildSourceMetadataFilePath,
  buildAdditionalSourcesFilePath,
  getDefaultOutputDir,
} from "@/server/wikiPipeline/io";
import { sanitizePoiIdForFile } from "@/server/wikiPipeline/normalize";
import type { Source } from "./types";
import { personRepository } from "@/server/person/filesystemRepository";
import { mainImageCandidatesArtifactSchema } from "@/server/wikiPipeline/types";
import { parseStoryContent } from "./storyContent";
import { toWikipediaSources } from "@/server/wikipediaSources";

const writeAtomically = (filePath: string, content: string) => {
  const temporaryFilePath = `${filePath}.tmp`;
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(temporaryFilePath, content, "utf-8");
  renameSync(temporaryFilePath, filePath);
};

const deleteFile = (filePath: string) => {
  if (existsSync(filePath)) {
    unlinkSync(filePath);
  }
};

const readSources = (city: string, poiId: string) => {
  const sourceFilePath = buildOutputFilePath(getDefaultOutputDir(city), poiId);
  const sourceMetadataFilePath = buildSourceMetadataFilePath(getDefaultOutputDir(city), poiId);
  const sourceContent = existsSync(sourceFilePath)
    ? readFileSync(sourceFilePath, "utf-8").trim()
    : undefined;
  const sourceMetadata = existsSync(sourceMetadataFilePath)
    ? (JSON.parse(readFileSync(sourceMetadataFilePath, "utf-8")) as Omit<Source, "content">)
    : undefined;
  const sources: Source[] =
    sourceContent && sourceMetadata ? [{ ...sourceMetadata, content: sourceContent }] : [];
  const additionalSourcesPath = buildAdditionalSourcesFilePath(getDefaultOutputDir(city), poiId);
  if (existsSync(additionalSourcesPath)) {
    sources.push(...(JSON.parse(readFileSync(additionalSourcesPath, "utf-8")) as Source[]));
  }
  return sources;
};

export const createFilesystemStoryWorkflowRepository = (city: string): StoryWorkflowRepository => ({
  get: async (poiId) => {
    const sources = readSources(city, poiId);
    // A refreshed Source set may temporarily differ from the previous saved Story.
    const storyContent = readStoryContent(city, poiId)?.content;
    const mainImageArtifact = readMainImageCandidateArtifact(city, poiId);
    const metadata = readGenerationMetadata(city)[sanitizePoiIdForFile(poiId)] ?? {};
    if (
      sources.length === 0 &&
      !storyContent &&
      !mainImageArtifact &&
      !metadata.wiki &&
      !metadata.storyContent &&
      !metadata.relatedPeople &&
      !metadata.image
    ) {
      return undefined;
    }

    const draftMainImage = mainImageArtifact?.candidates.find(
      (candidate) => candidate.commonsFileName === mainImageArtifact.selectedCommonsFileName,
    );
    return {
      poiId,
      sources,
      storyContent,
      mainImageCandidates: mainImageArtifact?.candidates ?? [],
      draftMainImage,
      generation: {
        sources: metadata.wiki,
        mainImageCandidates: metadata.image,
        storyContent: metadata.storyContent,
        relatedPeople: metadata.relatedPeople,
      },
    };
  },
  replaceSources: async (poiId, sources, checkpoint) => {
    const [source] = sources;
    if (!source) {
      throw new Error("A Source is required.");
    }
    const outputFilePath = buildOutputFilePath(getDefaultOutputDir(city), poiId);
    writeAtomically(outputFilePath, `${source.content.trim()}\n`);
    writeAtomically(
      buildAdditionalSourcesFilePath(getDefaultOutputDir(city), poiId),
      `${JSON.stringify(sources.slice(1), null, 2)}\n`,
    );
    writeAtomically(
      buildSourceMetadataFilePath(getDefaultOutputDir(city), poiId),
      `${JSON.stringify(
        {
          id: source.id,
          kind: source.kind,
          title: source.title,
          url: source.url,
          wikidataId: source.wikidataId,
          links: source.links,
        },
        null,
        2,
      )}\n`,
    );
    replaceGenerationCheckpoint(city, poiId, "wiki", checkpoint);
    console.info(`[wiki] Saved readable Wikipedia text for ${poiId} to ${outputFilePath}.`);
  },
  replaceMainImageCandidates: async (poiId, candidates, selectedCommonsFileName, checkpoint) => {
    mainImageCandidatesArtifactSchema.parse({ candidates, selectedCommonsFileName });
    const outputFilePath = buildMainImageCandidateArtifactFilePath(city, poiId);
    writeAtomically(
      outputFilePath,
      `${JSON.stringify({ candidates, selectedCommonsFileName }, null, 2)}\n`,
    );
    replaceGenerationCheckpoint(city, poiId, "image", checkpoint);
    console.info(
      `[wiki-images] Saved ${candidates.length} Main Image Candidates for ${poiId} to ${outputFilePath}.`,
    );
  },
  replaceStoryContent: async (poiId, storyContent, checkpoint, relatedPeopleCheckpoint) => {
    const sources = readSources(city, poiId);
    parseStoryContent(
      storyContent,
      sources.map(({ id }) => id),
    );
    for (const { personId } of storyContent.relatedPeople) {
      if (personId && !personRepository.get(personId)) {
        throw new Error(`Story ${poiId} references missing Person ${personId}.`);
      }
    }
    const outputFilePath = buildStoryContentFilePath(city, poiId);
    const sourceIds = new Set([
      ...storyContent.introduction.sourceIds,
      ...Object.values(storyContent.topics).flatMap((items) =>
        items.flatMap(({ sourceIds }) => sourceIds),
      ),
      ...storyContent.relatedPeople.flatMap(({ sourceIds }) => sourceIds),
    ]);
    writeAtomically(
      outputFilePath,
      `${JSON.stringify(
        {
          ...storyContent,
          wikipediaSources: toWikipediaSources(sources.filter(({ id }) => sourceIds.has(id))),
        },
        null,
        2,
      )}\n`,
    );
    replaceGenerationCheckpoint(city, poiId, "storyContent", checkpoint);
    if (relatedPeopleCheckpoint) {
      replaceGenerationCheckpoint(city, poiId, "relatedPeople", relatedPeopleCheckpoint);
    }
    console.info(`[story-content] Saved Story Content for ${poiId} to ${outputFilePath}.`);
  },
  selectDraftMainImage: async (poiId, commonsFileName) => {
    const artifact = readMainImageCandidateArtifact(city, poiId);
    if (!artifact) {
      throw new Error(`Main Image Candidates for ${poiId} not found.`);
    }
    mainImageCandidatesArtifactSchema.parse({
      ...artifact,
      selectedCommonsFileName: commonsFileName,
    });
    writeAtomically(
      buildMainImageCandidateArtifactFilePath(city, poiId),
      `${JSON.stringify({ ...artifact, selectedCommonsFileName: commonsFileName }, null, 2)}\n`,
    );
  },
  deleteStoryContent: async (poiId) => {
    deleteFile(buildStoryContentFilePath(city, poiId));
    deleteGenerationCheckpoints(city, poiId, ["storyContent", "relatedPeople"]);
  },
  deleteMainImageCandidates: async (poiId) => {
    deleteFile(buildMainImageCandidateArtifactFilePath(city, poiId));
    deleteGenerationCheckpoints(city, poiId, ["image"]);
  },
  reset: async (poiId, sourceMissing) => {
    deleteFile(buildOutputFilePath(getDefaultOutputDir(city), poiId));
    deleteFile(buildSourceMetadataFilePath(getDefaultOutputDir(city), poiId));
    deleteFile(buildAdditionalSourcesFilePath(getDefaultOutputDir(city), poiId));
    deleteFile(buildStoryContentFilePath(city, poiId));
    deleteFile(buildMainImageCandidateArtifactFilePath(city, poiId));
    deleteGenerationCheckpoints(city, poiId, ["wiki", "storyContent", "relatedPeople", "image"]);
    if (sourceMissing) markSourceMissing(city, poiId);
  },
});

export const filesystemStoryWorkflowRepository = createFilesystemStoryWorkflowRepository("rome");
