"use server";

import { createPoiTypeMappings } from "@/server/poiTypeMappings";
import { revalidatePath } from "next/cache";
import { people } from "@/server/person";
import { withPoiGeneration } from "@/server/poiGeneration";
import { generateStoryBatch } from "@/server/storyBatch";
import { pointOfInterest } from "@/server/pointOfInterest";
import { poiTypes } from "@/server/poiTypes";
import { findPoiInGeoJson, getDefaultInputPath } from "@/server/wikiPipeline/io";
import { resolvePageForPoi } from "@/server/wikiPipeline/resolve";
import { fetchWikiSnapshot } from "@/server/wikiPipeline/fetchWiki";
import { sanitizeErrorMessage, withGenerationRun } from "@/server/generationRunLog";
import { storyCuration } from "@/server/storyCuration";
import { storyWorkflow, StoryWorkflowError } from "@/server/storyWorkflow";
import { appendAiProgress, finishAiProgress, startAiProgress } from "@/server/aiProgress";
import type { RelatedPeopleResolutionFailure } from "@/server/storyWorkflow";
import { resolveAiSelection } from "./aiModels";
import type { AdminActionResult } from "./types";

const getRequiredString = (formData: FormData, key: string, label: string) => {
  const value = formData.get(key);
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Invalid ${label}.`);
  }
  return value.trim();
};

const toRelatedPeopleWarning = (
  failures: RelatedPeopleResolutionFailure[],
): AdminActionResult | undefined => {
  if (failures.length === 0) {
    return undefined;
  }

  return {
    warning: {
      title: "Some Related People remain unresolved",
    },
    failedSteps: ["Related People"],
  };
};

const runAiAction = async (
  formData: FormData,
  work: (onProgress: (message: string) => void) => Promise<AdminActionResult | undefined>,
) => {
  const progressId = formData.get("progressId");
  const runId = typeof progressId === "string" ? progressId : undefined;
  if (runId) startAiProgress(runId);
  const onProgress = (message: string) => {
    if (runId) appendAiProgress(runId, sanitizeErrorMessage(message));
  };

  try {
    const result = await work(onProgress);
    onProgress(result?.warning ? result.warning.title : "AI generation completed.");
    if (runId)
      finishAiProgress(runId, result?.warning ? "partial" : "succeeded", result?.failedSteps);
    return result;
  } catch (error) {
    onProgress("AI generation stopped.");
    if (runId)
      finishAiProgress(
        runId,
        error instanceof StoryWorkflowError && error.code === "source-not-found"
          ? "waiting"
          : "failed",
        [
          error instanceof StoryWorkflowError
            ? {
                sources: "Wikipedia Source",
                mainImageCandidates: "Main Image Candidates",
                storyContent: "Story Content",
                persistence: "Saving generated data",
              }[error.stage]
            : "Generation",
        ],
      );
    throw error;
  } finally {
    revalidatePath("/admin");
  }
};

export const generateDraftStory = async (formData: FormData) =>
  runAiAction(formData, async (onProgress) => {
    const geoPlaceId = getRequiredString(formData, "geoPlaceId", "Geo Place id");
    const ai = await resolveAiSelection(formData);
    const { result, poiTypesError, typeMappingError } = await withGenerationRun(
      { city: "rome", operation: "draftStory.generate", geoPlaceId, ai },
      async () => {
        onProgress("Creating the Point of Interest.");
        const { poiId } = await pointOfInterest.generate({ geoPlaceId });
        return withPoiGeneration(poiId, async () => {
          let poiTypesError: string | undefined;
          let typeMappingError: string | undefined;
          const result = await storyWorkflow.draftStory.generate({
            poiId,
            ai,
            onProgress,
            onSourcesAcquired: async (sources) => {
              try {
                const wikidataId = sources.find(({ kind }) => kind === "wikipedia")?.wikidataId;
                if (wikidataId) await pointOfInterest.linkWikidata({ poiId, wikidataId });
                onProgress("Checking POI types.");
                const types = await poiTypes.refresh(poiId);
                poiTypesError = types.error;
                if (!types.error && types.types.length) {
                  try {
                    onProgress("Matching new types to visitor categories.");
                    const classified = await createPoiTypeMappings().classify(
                      ai,
                      types.types.map((type) => type.id),
                    );
                    for (const city of classified.cities) revalidatePath(`/${city}`);
                  } catch (error) {
                    console.warn(`[poi-categories] Classification failed for ${poiId}.`, error);
                    typeMappingError = error instanceof Error ? error.message : String(error);
                    onProgress(
                      "Some category mappings remain unmapped; continuing Story generation.",
                    );
                  }
                }

                if (types.skipped) onProgress("Skipping POI types: no Wikidata ID.");
              } catch (error) {
                console.warn(`[poi-types] Refresh failed for ${poiId}.`, error);
                poiTypesError = error instanceof Error ? error.message : String(error);
              }
              if (poiTypesError) onProgress("POI Types could not be refreshed; continuing.");
            },
          });
          return { poiId, poiTypesError, typeMappingError, result };
        });
      },
      ({ poiId, result, poiTypesError }) => ({
        poiId,
        status:
          poiTypesError ||
          result.mainImageCandidates === "failed" ||
          result.relatedPeopleFailures.length > 0
            ? "partial"
            : "success",
        failedSteps: [
          ...(poiTypesError ? ["poiTypes"] : []),
          ...(result.mainImageCandidates === "failed" ? ["mainImageCandidates"] : []),
          ...(result.relatedPeopleFailures.length > 0 ? ["relatedPeople"] : []),
        ],
        relatedPeopleFailureCount: result.relatedPeopleFailures.length,
        errors: [
          ...(poiTypesError ? [{ stage: "poiTypes", message: poiTypesError }] : []),
          ...(result.mainImageCandidatesError
            ? [{ stage: "mainImageCandidates", message: result.mainImageCandidatesError }]
            : []),
          ...result.relatedPeopleFailures.map(({ name, message }) => ({
            stage: "relatedPeople",
            name,
            message,
          })),
        ],
      }),
    );
    const failedSteps = [
      ...(poiTypesError ? ["POI Types"] : []),
      ...(result.mainImageCandidates === "failed" ? ["Main Image Candidates"] : []),
      ...(result.relatedPeopleFailures.length ? ["Related People"] : []),
    ];
    return failedSteps.length
      ? {
          warning: {
            title: "Draft generated with issues",
            description: `Failed steps: ${failedSteps.join(", ")}.`,
          },
          failedSteps,
        }
      : typeMappingError
        ? {
            warning: {
              title: "Story generated; some category mappings remain unmapped",
              description: "Retry classification from Type mappings.",
              details: typeMappingError,
            },
          }
        : undefined;
  });

export const refreshStoryContent = async (formData: FormData) =>
  runAiAction(formData, async (onProgress) => {
    const poiId = getRequiredString(formData, "poiId", "POI id");
    const ai = await resolveAiSelection(formData);
    const result = await withGenerationRun(
      { city: "rome", operation: "storyContent.generate", poiId, ai },
      () =>
        withPoiGeneration(poiId, () =>
          storyWorkflow.storyContent.generate({ poiId, ai, onProgress }),
        ),
      ({ failures }) => ({
        status: failures.length > 0 ? "partial" : "success",
        failedSteps: failures.length > 0 ? ["relatedPeople"] : [],
        relatedPeopleFailureCount: failures.length,
        errors: failures.map(({ name, message }) => ({ stage: "relatedPeople", name, message })),
      }),
    );
    return toRelatedPeopleWarning(result.failures);
  });

export const regeneratePerson = async (formData: FormData) =>
  runAiAction(formData, async (onProgress) => {
    await people.regenerate({
      personId: getRequiredString(formData, "personId", "Person id"),
      ai: await resolveAiSelection(formData),
      onProgress,
    });
    revalidatePath("/rome");
  });

export const refreshPoiTypes = async (formData: FormData): Promise<AdminActionResult | void> => {
  const poiId = getRequiredString(formData, "poiId", "POI id");
  const result = await withPoiGeneration(poiId, async () => {
    try {
      const poi = findPoiInGeoJson(getDefaultInputPath("rome"), poiId, "rome");
      if (!poi.sourceHints.wikidata) {
        const page = (await resolvePageForPoi(poi)).selected;
        const snapshot = await fetchWikiSnapshot(page.title, page.language);
        if (snapshot.wikidataId) {
          await pointOfInterest.linkWikidata({ poiId, wikidataId: snapshot.wikidataId });
        }
      }
      return await poiTypes.refresh(poiId);
    } catch (error) {
      console.warn(`[poi-types] Refresh failed for ${poiId}.`, error);
      return { error: error instanceof Error ? error.message : String(error) };
    }
  });
  let mappingError: string | undefined;
  if (!result.error && "types" in result && result.types?.length) {
    try {
      const classified = await createPoiTypeMappings().classify(
        await resolveAiSelection(formData),
        result.types.map((type) => type.id),
      );
      for (const city of classified.cities) revalidatePath(`/${city}`);
    } catch (error) {
      console.warn(`[poi-categories] Classification failed for ${poiId}.`, error);
      mappingError = error instanceof Error ? error.message : String(error);
    }
  }
  revalidatePath("/admin");
  if ("skipped" in result && result.skipped) {
    return {
      warning: {
        title: "No Wikidata ID found",
        description: "The Wikipedia page has no Wikidata ID, so its types could not be generated.",
      },
    };
  }
  if (result.error) {
    return {
      warning: {
        title: "POI types could not be refreshed",
        description: "Previously saved types remain available when present.",
        details: result.error,
      },
    };
  }
  if (mappingError)
    return {
      warning: {
        title: "Types refreshed; some categories remain unmapped",
        description: "Retry classification from Type mappings.",
        details: mappingError,
      },
    };
};

export const resolveRelatedPeople = async (formData: FormData) =>
  runAiAction(formData, async (onProgress) => {
    const poiId = getRequiredString(formData, "poiId", "POI id");
    const ai = await resolveAiSelection(formData);
    const result = await withGenerationRun(
      { city: "rome", operation: "relatedPeople.resolve", poiId, ai },
      () =>
        withPoiGeneration(poiId, () =>
          storyWorkflow.relatedPeople.resolve({ poiId, ai, onProgress }),
        ),
      ({ failures }) => ({
        status: failures.length > 0 ? "partial" : "success",
        failedSteps: failures.length > 0 ? ["relatedPeople"] : [],
        relatedPeopleFailureCount: failures.length,
        errors: failures.map(({ name, message }) => ({ stage: "relatedPeople", name, message })),
      }),
    );
    return toRelatedPeopleWarning(result.failures);
  });

export const refreshMainImageCandidates = async (formData: FormData) => {
  const poiId = getRequiredString(formData, "poiId", "POI id");
  await withGenerationRun({ city: "rome", operation: "mainImageCandidates.generate", poiId }, () =>
    withPoiGeneration(poiId, () => storyWorkflow.mainImageCandidates.generate({ poiId })),
  );
  revalidatePath("/admin");
};

export const deleteStoryContent = async (formData: FormData) => {
  const poiId = getRequiredString(formData, "poiId", "POI id");
  await withPoiGeneration(poiId, () => storyWorkflow.storyContent.delete({ poiId }));
  revalidatePath("/admin");
};

export const deleteMainImageCandidates = async (formData: FormData) => {
  const poiId = getRequiredString(formData, "poiId", "POI id");
  await withPoiGeneration(poiId, () => storyWorkflow.mainImageCandidates.delete({ poiId }));
  revalidatePath("/admin");
};

export const selectMainImageCandidate = async (formData: FormData) => {
  const poiId = getRequiredString(formData, "poiId", "POI id");
  await withPoiGeneration(poiId, () =>
    storyCuration.selectDraftMainImage({
      poiId,
      commonsFileName: getRequiredString(formData, "commonsFileName", "Commons file name"),
    }),
  );
  revalidatePath("/admin");
};

export const generateDraftStories = async (formData: FormData) => {
  const ai = await resolveAiSelection(formData);
  const progressIds = formData.getAll("progressId");
  if (progressIds.length !== formData.getAll("geoPlaceId").length) {
    throw new Error("Each selected POI needs a progress ID.");
  }
  return generateStoryBatch(
    formData.getAll("geoPlaceId").map((geoPlaceId, index) => ({
      geoPlaceId,
      progressId: progressIds[index],
    })),
    async ({ geoPlaceId, progressId }) => {
      const input = new FormData();
      input.set("geoPlaceId", geoPlaceId);
      input.set("progressId", progressId);
      input.set("aiMode", ai.mode);
      input.set("aiModel", ai.model);
      return generateDraftStory(input);
    },
  );
};

export const saveTypeMapping = async (
  id: string,
  categories: import("@/types/PoiCategory").PoiCategory[] | null,
) => {
  const result = createPoiTypeMappings().save(id, categories);
  revalidatePath("/admin");
  for (const city of result.cities) revalidatePath(`/${city}`);
  return result;
};

export const classifyTypeMappings = async (formData: FormData) => {
  try {
    return await createPoiTypeMappings().classify(await resolveAiSelection(formData));
  } finally {
    revalidatePath("/", "layout");
  }
};

export const savePoiCategory = async (id: string | null, name: string) => {
  const result = createPoiTypeMappings().saveCategory(id, name);
  revalidatePath("/", "layout");
  return result;
};

export const deletePoiCategory = async (id: string) => {
  const result = createPoiTypeMappings().deleteCategory(id);
  revalidatePath("/", "layout");
  return result;
};

export const movePoiCategory = async (id: string, parent: string | null) => {
  const result = createPoiTypeMappings().moveCategory(id, parent);
  revalidatePath("/", "layout");
  return result;
};
