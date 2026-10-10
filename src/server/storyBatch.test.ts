import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { generateStoryBatch } from "./storyBatch";
import { createDraftStoryGeneration } from "./draftStoryGeneration";
import type { GenerationLogEntry } from "./generationRunLog";
import { StoryWorkflowError } from "./storyWorkflow";

describe("manual Story batch", () => {
  it.each(["success", "types", "mappings", "artifacts"])(
    "coordinates three independent runs, logs %s consistently, and stops",
    async (outcome) => {
      const started: string[] = [];
      const events: string[] = [];
      const logs: Partial<GenerationLogEntry>[] = [];
      const changedCities: string[][] = [];
      let finish = () => {};
      const pending = new Promise<void>((resolve) => {
        finish = resolve;
      });
      const generate = createDraftStoryGeneration({
        pointOfInterest: {
          generate: async ({ geoPlaceId }) => {
            started.push(geoPlaceId);
            return { poiId: geoPlaceId };
          },
          linkWikidata: async ({ poiId }) => {
            events.push(`${poiId}:link`);
          },
        },
        poiTypes: {
          refresh: async (poiId) => {
            events.push(`${poiId}:types`);
            return poiId === "three" && outcome === "types"
              ? { types: [], error: "Wikidata unavailable" }
              : { types: [{ id: poiId, label: "Church" }] };
          },
        },
        typeMappings: {
          classify: async (ai, ids) => {
            expect(ai).toEqual({ mode: "cloud", provider: "ollama", model: "test-model" });
            events.push(`${ids?.[0]}:mappings`);
            if (ids?.[0] === "three" && outcome === "mappings")
              throw new Error("Classification unavailable");
            return { classified: 1, createdCategories: 0, updatedPois: 1, cities: ["rome"] };
          },
        },
        draftStory: {
          generate: async ({ poiId, onSourcesAcquired }) => {
            await pending;
            if (poiId === "two")
              throw new StoryWorkflowError({
                code: "sources-unavailable",
                stage: "sources",
                retryable: true,
                cause: new Error("HTTP 429"),
              });
            await onSourcesAcquired?.([
              {
                id: "wikipedia",
                kind: "wikipedia",
                title: "Church",
                url: "https://en.wikipedia.org/wiki/Church",
                content: "Sourced history",
                wikidataId: "Q100",
              },
            ]);
            events.push(`${poiId}:story`);
            return {
              poiId,
              mainImageCandidates:
                poiId === "three" && outcome === "artifacts" ? "failed" : "generated",
              ...(poiId === "three" && outcome === "artifacts"
                ? { mainImageCandidatesError: "Commons unavailable" }
                : {}),
              draftMainImage: "available",
              storyContent: "generated",
              relatedPeople: poiId === "three" && outcome === "artifacts" ? "partial" : "resolved",
              relatedPeopleFailures:
                poiId === "three" && outcome === "artifacts"
                  ? [{ name: "Pope Innocent X", message: "Person unavailable" }]
                  : [],
            };
          },
        },
        recordRun: async (input, work, summarize) => {
          const result = await work();
          logs.push({ ...input, ...summarize?.(result) });
          return result;
        },
      });
      const runs = ["one", "two", "three"].map((geoPlaceId) => ({
        geoPlaceId,
        progressId: randomUUID(),
      }));
      const batch = generateStoryBatch(runs, ({ geoPlaceId }) =>
        generate({
          geoPlaceId,
          ai: { mode: "cloud", provider: "ollama", model: "test-model" },
          onCategoriesChanged: (cities) => changedCities.push(cities),
        }),
      );
      expect(started).toEqual(["one", "two", "three"]);
      finish();
      const results = await batch;
      expect(results[0]).toEqual({ ...runs[0], result: undefined });
      expect(results[1]).toEqual({ ...runs[1], error: "sources-unavailable: HTTP 429" });
      const third = "result" in results[2] ? results[2].result : undefined;
      const log = logs.find(({ poiId }) => poiId === "three");
      expect(log?.status).toBe(outcome === "success" ? "success" : "partial");
      expect(Boolean(third?.warning)).toBe(outcome !== "success");
      expect(events.filter((event) => event.startsWith("three:"))).toEqual([
        "three:link",
        "three:types",
        ...(outcome === "types" ? [] : ["three:mappings"]),
        "three:story",
      ]);
      if (outcome === "mappings") {
        expect(third).toMatchObject({
          failedSteps: ["POI Type Mappings"],
          warning: {
            description: "Retry classification from Type mappings.",
            details: "Classification unavailable",
          },
        });
        expect(log).toMatchObject({
          failedSteps: ["poiTypeMappings"],
          errors: [{ stage: "poiTypeMappings", message: "Classification unavailable" }],
        });
      } else if (outcome === "types") {
        expect(third?.failedSteps).toEqual(["POI Types"]);
        expect(log?.errors).toEqual([{ stage: "poiTypes", message: "Wikidata unavailable" }]);
      } else if (outcome === "artifacts") {
        expect(third?.failedSteps).toEqual(["Main Image Candidates", "Related People"]);
        expect(log).toMatchObject({
          relatedPeopleFailureCount: 1,
          failedSteps: ["mainImageCandidates", "relatedPeople"],
        });
      }
      expect(events.some((event) => event.startsWith("two:"))).toBe(false);
      expect(started).toHaveLength(3);
      expect(changedCities).toEqual(
        outcome === "types" || outcome === "mappings" ? [["rome"]] : [["rome"], ["rome"]],
      );
      await expect(
        generate({
          geoPlaceId: "one",
          ai: { mode: "cloud", provider: "ollama", model: "test-model" },
        }),
      ).resolves.toBeUndefined();
      expect(events.filter((event) => event === "one:mappings")).toHaveLength(2);
      await expect(
        generate({
          geoPlaceId: "two",
          ai: { mode: "cloud", provider: "ollama", model: "test-model" },
        }),
      ).rejects.toThrow("HTTP 429");
    },
  );

  it("validates the entire selection before starting any work", async () => {
    const started: string[] = [];
    for (const ids of [[], ["one", "two", "three", "four"], ["one", "one"], [""]]) {
      await expect(
        generateStoryBatch(
          ids.map((geoPlaceId) => ({ geoPlaceId, progressId: randomUUID() })),
          async ({ geoPlaceId }) => {
            started.push(geoPlaceId);
          },
        ),
      ).rejects.toThrow();
    }
    await expect(
      generateStoryBatch([{ geoPlaceId: "one", progressId: "invalid" }], async () => {
        started.push("one");
      }),
    ).rejects.toThrow();
    expect(started).toEqual([]);
  });
});
