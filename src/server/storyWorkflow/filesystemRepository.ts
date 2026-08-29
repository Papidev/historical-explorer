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
  readGenerationMetadata,
  replaceGenerationCheckpoint,
} from "@/server/generationMetadata";
import {
  buildMainImageCandidateArtifactFilePath,
  readMainImageCandidateArtifact,
} from "./mainImageCandidateArtifacts";
import { buildStoryFilePath, readStory } from "./storyArtifacts";
import { buildStoryContentFilePath, readStoryContent } from "./storyContentArtifacts";
import type { StoryWorkflowRepository } from "./createStoryWorkflow";
import {
  buildOutputFilePath,
  buildSourceMetadataFilePath,
  getDefaultOutputDir,
} from "@/server/wikiPipeline/io";
import { sanitizePoiIdForFile } from "@/server/wikiPipeline/normalize";
import type { Source } from "./types";

const city = "rome";

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

export const filesystemStoryWorkflowRepository: StoryWorkflowRepository = {
  get: async (poiId) => {
    const sourceFilePath = buildOutputFilePath(getDefaultOutputDir(city), poiId);
    const sourceMetadataFilePath = buildSourceMetadataFilePath(getDefaultOutputDir(city), poiId);
    const sourceContent = existsSync(sourceFilePath)
      ? readFileSync(sourceFilePath, "utf-8").trim()
      : undefined;
    const sourceMetadata = existsSync(sourceMetadataFilePath)
      ? (JSON.parse(readFileSync(sourceMetadataFilePath, "utf-8")) as Omit<Source, "content">)
      : undefined;
    const sources =
      sourceContent && sourceMetadata ? [{ ...sourceMetadata, content: sourceContent }] : [];
    const storyContent = readStoryContent(
      poiId,
      sources.length > 0 ? sources.map((source) => source.id) : undefined,
    )?.content;
    const storyProse = readStory(poiId)?.content;
    const mainImageArtifact = readMainImageCandidateArtifact(poiId);
    const metadata = readGenerationMetadata()[sanitizePoiIdForFile(poiId)] ?? {};
    if (
      !sourceContent &&
      !storyContent &&
      !storyProse &&
      !mainImageArtifact &&
      !metadata.wiki &&
      !metadata.storyContent &&
      !metadata.ai &&
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
      storyProse,
      mainImageCandidates: mainImageArtifact?.candidates ?? [],
      draftMainImage,
      generation: {
        sources: metadata.wiki,
        mainImageCandidates: metadata.image,
        storyContent: metadata.storyContent,
        storyProse: metadata.ai,
      },
    };
  },
  replaceSources: async (poiId, sources, checkpoint) => {
    if (sources.length !== 1) {
      throw new Error("Filesystem Source persistence currently requires one Source.");
    }
    const [source] = sources;
    if (!source) {
      throw new Error("A Source is required.");
    }
    const outputFilePath = buildOutputFilePath(getDefaultOutputDir(city), poiId);
    writeAtomically(outputFilePath, `${source.content.trim()}\n`);
    writeAtomically(
      buildSourceMetadataFilePath(getDefaultOutputDir(city), poiId),
      `${JSON.stringify(
        {
          id: source.id,
          kind: source.kind,
          title: source.title,
          url: source.url,
        },
        null,
        2,
      )}\n`,
    );
    replaceGenerationCheckpoint(poiId, "wiki", checkpoint);
    console.info(`[wiki] Saved readable Wikipedia text for ${poiId} to ${outputFilePath}.`);
  },
  replaceMainImageCandidates: async (poiId, candidates, selectedCommonsFileName, checkpoint) => {
    const outputFilePath = buildMainImageCandidateArtifactFilePath(poiId);
    writeAtomically(
      outputFilePath,
      `${JSON.stringify({ candidates, selectedCommonsFileName }, null, 2)}\n`,
    );
    replaceGenerationCheckpoint(poiId, "image", checkpoint);
    console.info(
      `[wiki-images] Saved ${candidates.length} Main Image Candidates for ${poiId} to ${outputFilePath}.`,
    );
  },
  replaceStoryProse: async (poiId, storyProse, checkpoint) => {
    const outputFilePath = buildStoryFilePath(poiId);
    writeAtomically(outputFilePath, `${storyProse.trim()}\n`);
    replaceGenerationCheckpoint(poiId, "ai", checkpoint);
    console.info(`[wiki-ai] Saved AI text for ${poiId} to ${outputFilePath}.`);
  },
  replaceStoryContent: async (poiId, storyContent, checkpoint) => {
    const outputFilePath = buildStoryContentFilePath(poiId);
    writeAtomically(outputFilePath, `${JSON.stringify(storyContent, null, 2)}\n`);
    replaceGenerationCheckpoint(poiId, "storyContent", checkpoint);
    console.info(`[story-content] Saved Story Content for ${poiId} to ${outputFilePath}.`);
  },
  deleteStoryProse: async (poiId) => {
    deleteFile(buildStoryFilePath(poiId));
    deleteGenerationCheckpoints(poiId, ["ai"]);
  },
  deleteStoryContent: async (poiId) => {
    deleteFile(buildStoryContentFilePath(poiId));
    deleteGenerationCheckpoints(poiId, ["storyContent"]);
  },
  deleteMainImageCandidates: async (poiId) => {
    deleteFile(buildMainImageCandidateArtifactFilePath(poiId));
    deleteGenerationCheckpoints(poiId, ["image"]);
  },
  reset: async (poiId) => {
    deleteFile(buildOutputFilePath(getDefaultOutputDir(city), poiId));
    deleteFile(buildSourceMetadataFilePath(getDefaultOutputDir(city), poiId));
    deleteFile(buildStoryContentFilePath(poiId));
    deleteFile(buildStoryFilePath(poiId));
    deleteFile(buildMainImageCandidateArtifactFilePath(poiId));
    deleteGenerationCheckpoints(poiId, ["wiki", "ai", "storyContent", "image"]);
  },
};
