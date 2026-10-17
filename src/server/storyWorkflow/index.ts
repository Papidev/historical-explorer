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
import { resolvePageForPoi, WikipediaSourceMissingError } from "@/server/wikiPipeline/resolve";
import { wikiTextToPlainText } from "@/server/wikiPipeline/wikiText";
import { people } from "@/server/person";
import { acquireWikipediaSources } from "@/server/wikiPipeline/acquireWikipediaSources";
import { throwIfGenerationCancelled } from "@/server/generationCancellation";
import type { Source } from "./types";

export const createStoryWorkflowForCity = (city: string) =>
  createStoryWorkflow({
    findPointOfInterest: async (poiId) => {
      try {
        return findPoiInGeoJson(getDefaultInputPath(city), poiId, city);
      } catch {
        return undefined;
      }
    },
    acquireSources: async (pointOfInterest) => {
      console.info(`[wiki] Fetching Wikipedia text for ${pointOfInterest.id}.`);
      const page = (await resolvePageForPoi(pointOfInterest)).selected;
      let initialSource: Source | undefined;
      const warnings: string[] = [];
      try {
        const snapshot = await fetchWikiSnapshot(page.title, page.language);
        if (snapshot.isDisambiguation) throw new WikipediaSourceMissingError(pointOfInterest.id);
        if (page.wikidataId && snapshot.wikidataId !== page.wikidataId)
          throw new Error("The Wikipedia article identity changed during acquisition.");
        initialSource = {
          id: "wikipedia",
          kind: "wikipedia",
          title: snapshot.title,
          ...(snapshot.wikidataId ? { wikidataId: snapshot.wikidataId } : {}),
          url: buildWikipediaPageUrl(snapshot.title, page.language),
          content: wikiTextToPlainText(snapshot.fullText),
          links: snapshot.links,
        };
      } catch (error) {
        throwIfGenerationCancelled();
        if (error instanceof WikipediaSourceMissingError || !page.wikidataId) throw error;
        warnings.push(`The initial Wikipedia article could not be acquired: ${String(error)}`);
      }
      const acquired = await acquireWikipediaSources({
        wikidataId: initialSource?.wikidataId ?? page.wikidataId,
        initialSource,
      });
      return { sources: acquired.sources, warnings: [...warnings, ...acquired.warnings] };
    },
    generateMainImageCandidates: async (pointOfInterest, wikipediaTitle, wikipediaLanguage) => {
      console.info(`[wiki-images] Generating Main Image Candidates for ${pointOfInterest.id}.`);
      return fetchMainImageCandidates(pointOfInterest, wikipediaTitle, wikipediaLanguage);
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
          mode: ai.mode,
          provider,
          model: ai.model,
        }),
        provider,
      };
    },
    resolveRelatedPeople: ({ relatedPeople, sources, ai, onProgress }) =>
      people.resolveAndGenerateMissing({ relatedPeople, storySources: sources, ai, onProgress }),
    repository: createFilesystemStoryWorkflowRepository(city),
  });

export const storyWorkflow = createStoryWorkflowForCity("rome");

export type {
  AiSelection,
  DraftMainImage,
  DraftStoryGenerationResult,
  DraftStoryGenerationStatus,
  DraftStorySnapshot,
  RelatedPeopleResolutionFailure,
  RelatedPeopleResolutionResult,
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
