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
import type { StoryWorkflowRepository } from "./createStoryWorkflow";
import { buildOutputFilePath, getDefaultOutputDir } from "@/server/wikiPipeline/io";
import { sanitizePoiIdForFile } from "@/server/wikiPipeline/normalize";

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
    const sourceContent = existsSync(sourceFilePath)
      ? readFileSync(sourceFilePath, "utf-8").trim()
      : undefined;
    const storyProse = readStory(poiId)?.content;
    const mainImageArtifact = readMainImageCandidateArtifact(poiId);
    const metadata = readGenerationMetadata()[sanitizePoiIdForFile(poiId)] ?? {};
    if (
      !sourceContent &&
      !storyProse &&
      !mainImageArtifact &&
      !metadata.wiki &&
      !metadata.ai &&
      !metadata.image
    ) {
      return undefined;
    }

    const draftMainImage = mainImageArtifact?.candidates.find(
      (candidate) =>
        candidate.commonsFileName === mainImageArtifact.selectedCommonsFileName,
    );
    return {
      poiId,
      sources: sourceContent ? [{ kind: "wikipedia", content: sourceContent }] : [],
      storyProse,
      mainImageCandidates: mainImageArtifact?.candidates ?? [],
      draftMainImage,
      generation: {
        sources: metadata.wiki,
        mainImageCandidates: metadata.image,
        storyProse: metadata.ai,
      },
    };
  },
  replaceSources: async (poiId, sources, checkpoint) => {
    const outputFilePath = buildOutputFilePath(getDefaultOutputDir(city), poiId);
    writeAtomically(
      outputFilePath,
      `${sources.map((source) => source.content.trim()).join("\n\n")}\n`,
    );
    replaceGenerationCheckpoint(poiId, "wiki", checkpoint);
    console.info(`[wiki] Saved readable Wikipedia text for ${poiId} to ${outputFilePath}.`);
  },
  replaceMainImageCandidates: async (
    poiId,
    candidates,
    selectedCommonsFileName,
    checkpoint,
  ) => {
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
  deleteStoryProse: async (poiId) => {
    deleteFile(buildStoryFilePath(poiId));
    deleteGenerationCheckpoints(poiId, ["ai"]);
  },
  deleteMainImageCandidates: async (poiId) => {
    deleteFile(buildMainImageCandidateArtifactFilePath(poiId));
    deleteGenerationCheckpoints(poiId, ["image"]);
  },
  reset: async (poiId) => {
    deleteFile(buildOutputFilePath(getDefaultOutputDir(city), poiId));
    deleteFile(buildStoryFilePath(poiId));
    deleteFile(buildMainImageCandidateArtifactFilePath(poiId));
    deleteGenerationCheckpoints(poiId, ["wiki", "ai", "image"]);
  },
};
