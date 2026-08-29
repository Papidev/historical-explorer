import { enrichWikiText } from "./enrichWikiText";
import { generateStoryContent } from "./generateStoryContent";
import { createStoryWorkflow } from "./createStoryWorkflow";
import { filesystemStoryWorkflowRepository } from "./filesystemRepository";
import { fetchMainImageCandidates } from "./mainImageCandidates";
import { fetchWikiSnapshot } from "@/server/wikiPipeline/fetchWiki";
import {
  buildWikipediaPageUrl,
  findPoiInGeoJson,
  getDefaultInputPath,
} from "@/server/wikiPipeline/io";
import { resolvePageForPoi } from "@/server/wikiPipeline/resolve";
import { wikiTextToPlainText } from "@/server/wikiPipeline/wikiText";

const city = "rome";

export const storyWorkflow = createStoryWorkflow({
  findPointOfInterest: async (poiId) => {
    try {
      return findPoiInGeoJson(getDefaultInputPath(city), poiId, city);
    } catch {
      return undefined;
    }
  },
  acquireSources: async (pointOfInterest) => {
    console.info(`[wiki] Fetching Wikipedia text for ${pointOfInterest.id}.`);
    const resolved = await resolvePageForPoi(pointOfInterest);
    const snapshot = await fetchWikiSnapshot(resolved.selected.title);
    return [
      {
        id: "wikipedia",
        kind: "wikipedia",
        title: resolved.selected.title,
        url: buildWikipediaPageUrl(resolved.selected.title),
        content: wikiTextToPlainText(snapshot.fullText),
      },
    ];
  },
  generateMainImageCandidates: async (pointOfInterest) => {
    console.info(`[wiki-images] Generating Main Image Candidates for ${pointOfInterest.id}.`);
    return fetchMainImageCandidates(pointOfInterest);
  },
  generateStoryProse: async ({ pointOfInterest, sources, ai }) => {
    const provider =
      ai.mode === "local"
        ? process.env.LOCAL_AI_PROVIDER === "gemini"
          ? "gemini"
          : "ollama"
        : process.env.CLOUD_AI_PROVIDER === "ollama"
          ? "ollama"
          : "gemini";
    console.info(
      `[wiki-ai] Generating AI text for ${pointOfInterest.id} with ${ai.mode}/${provider}/${ai.model}.`,
    );
    return {
      content: `# ${pointOfInterest.name} (${pointOfInterest.id})\n\n${(
        await enrichWikiText(sources.map((source) => source.content).join("\n\n"), {
          provider,
          model: ai.model,
        })
      ).trim()}`,
      provider,
    };
  },
  generateStoryContent: async ({ pointOfInterest, sources, ai }) => {
    const provider =
      ai.mode === "local"
        ? process.env.LOCAL_AI_PROVIDER === "gemini"
          ? "gemini"
          : "ollama"
        : process.env.CLOUD_AI_PROVIDER === "ollama"
          ? "ollama"
          : "gemini";
    return {
      content: await generateStoryContent(pointOfInterest, sources, {
        provider,
        model: ai.model,
      }),
      provider,
    };
  },
  repository: filesystemStoryWorkflowRepository,
});

export type {
  AiSelection,
  DraftMainImage,
  DraftStoryGenerationResult,
  DraftStoryGenerationStatus,
  DraftStorySnapshot,
  Source,
  StoryWorkflow,
  StoryWorkflowErrorCode,
  StoryWorkflowErrorStage,
} from "./types";
export type {
  HistoryInsight,
  PublicStoryContent,
  RelatedPerson,
  StoryContent,
  StoryInsight,
} from "./storyContent";
export { StoryWorkflowError } from "./types";
