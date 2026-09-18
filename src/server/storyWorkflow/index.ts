import { generateStoryContent } from "./generateStoryContent";
import { createStoryWorkflow } from "./createStoryWorkflow";
import { createFilesystemStoryWorkflowRepository } from "./filesystemRepository";
import { fetchMainImageCandidates } from "./mainImageCandidates";
import { fetchWikiSnapshot } from "@/server/wikiPipeline/fetchWiki";
import {
  buildWikipediaPageUrl,
  findPoiInGeoJson,
  getDefaultInputPath,
} from "@/server/wikiPipeline/io";
import { resolvePageForPoi } from "@/server/wikiPipeline/resolve";
import { wikiTextToPlainText } from "@/server/wikiPipeline/wikiText";
import { personProfiles } from "@/server/personProfile";

export const createStoryWorkflowForCity = (city: string) => createStoryWorkflow({
  findPointOfInterest: async (poiId) => {
    try {
      return findPoiInGeoJson(getDefaultInputPath(city), poiId, city);
    } catch {
      return undefined;
    }
  },
  acquireSources: async (pointOfInterest, previousSources) => {
    console.info(`[wiki] Fetching Wikipedia text for ${pointOfInterest.id}.`);
    const title =
      previousSources?.find(({ kind }) => kind === "wikipedia")?.title ??
      (await resolvePageForPoi(pointOfInterest)).selected.title;
    const snapshot = await fetchWikiSnapshot(title);
    return [
      {
        id: "wikipedia",
        kind: "wikipedia",
        title: snapshot.title,
        url: buildWikipediaPageUrl(snapshot.title),
        content: wikiTextToPlainText(snapshot.fullText),
        links: snapshot.links,
      },
    ];
  },
  generateMainImageCandidates: async (pointOfInterest) => {
    console.info(`[wiki-images] Generating Main Image Candidates for ${pointOfInterest.id}.`);
    return fetchMainImageCandidates(pointOfInterest);
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
  resolveRelatedPeople: ({ relatedPeople, sources, ai }) =>
    personProfiles.resolveAndGenerateMissing({ relatedPeople, storySources: sources, ai }),
  repository: createFilesystemStoryWorkflowRepository(city),
});

export const storyWorkflow = createStoryWorkflowForCity("rome");

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
