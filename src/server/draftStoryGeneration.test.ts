import { describe, expect, it } from "vitest";
import { createDraftStoryGeneration } from "./draftStoryGeneration";
import type { GenerationLogEntry } from "./generationRunLog";

describe("Draft Story source warnings", () => {
  it.each([false, true])(
    "keeps warnings separate from failed steps (image failure: %s)",
    async (imageFailed) => {
      let outcome: Partial<GenerationLogEntry> | undefined;
      const generate = createDraftStoryGeneration({
        pointOfInterest: {
          generate: async () => ({ poiId: "porta-salaria" }),
          linkWikidata: async () => {},
        },
        poiTypes: { refresh: async () => ({ types: [] }) },
        typeMappings: {
          classify: async () => ({
            classified: 0,
            createdCategories: 0,
            updatedPois: 0,
            cities: [],
          }),
        },
        draftStory: {
          generate: async () => ({
            poiId: "porta-salaria",
            mainImageCandidates: imageFailed ? "failed" : "generated",
            mainImageCandidatesError: imageFailed ? "No images available" : undefined,
            draftMainImage: "available",
            storyContent: "generated",
            relatedPeople: "resolved",
            relatedPeopleFailures: [],
            sourceWarnings: ["Aurelian: No official languages were found for country Q1747689."],
          }),
        },
        recordRun: async (_input, run, summarize) => {
          const result = await run();
          outcome = summarize?.(result);
          return result;
        },
      });
      const result = await generate({
        geoPlaceId: "Q1657663",
        ai: { mode: "local", provider: "ollama", model: "test" },
      });
      expect(outcome).toMatchObject({
        status: imageFailed ? "partial" : "success",
        failedSteps: imageFailed ? ["mainImageCandidates"] : [],
        errors: imageFailed
          ? [{ stage: "mainImageCandidates", message: "No images available" }]
          : [],
        sourceWarnings: ["Aurelian: No official languages were found for country Q1747689."],
      });
      expect(result?.failedSteps).toEqual(imageFailed ? ["Main Image Candidates"] : []);
      expect(result?.warning.details).toContain("No official languages");
    },
  );
});
