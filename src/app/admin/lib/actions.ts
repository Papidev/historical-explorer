"use server";

import { revalidatePath } from "next/cache";
import { pointOfInterest } from "@/server/pointOfInterest";
import { poiTypes } from "@/server/poiTypes";
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

const getWorkflowAiSelection = async (formData: FormData) => {
  const { mode, model } = await resolveAiSelection(formData);
  return { mode, model };
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
    revalidatePath("/admin");
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
  }
};

export const generateDraftStory = async (formData: FormData) =>
  runAiAction(formData, async (onProgress) => {
    const geoPlaceId = getRequiredString(formData, "geoPlaceId", "Geo Place id");
    const ai = await getWorkflowAiSelection(formData);
    const { result, poiTypesError } = await withGenerationRun(
      { city: "rome", operation: "draftStory.generate", geoPlaceId, ai },
      async () => {
        onProgress("Creating the Point of Interest.");
        const { poiId } = await pointOfInterest.generate({ geoPlaceId });
        let poiTypesError: string | undefined;
        try {
          onProgress("Refreshing POI types.");
          poiTypesError = (await poiTypes.refresh(poiId)).error;
        } catch (error) {
          console.warn(`[poi-types] Refresh failed for ${poiId}.`, error);
          poiTypesError = error instanceof Error ? error.message : String(error);
        }
        if (poiTypesError) onProgress("POI Types could not be refreshed; continuing.");
        return {
          poiId,
          poiTypesError,
          result: await storyWorkflow.draftStory.generate({ poiId, ai, onProgress }),
        };
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
      : undefined;
  });

export const refreshStoryContent = async (formData: FormData) =>
  runAiAction(formData, async (onProgress) => {
    const poiId = getRequiredString(formData, "poiId", "POI id");
    const ai = await getWorkflowAiSelection(formData);
    const result = await withGenerationRun(
      { city: "rome", operation: "storyContent.generate", poiId, ai },
      () => storyWorkflow.storyContent.generate({ poiId, ai, onProgress }),
      ({ failures }) => ({
        status: failures.length > 0 ? "partial" : "success",
        failedSteps: failures.length > 0 ? ["relatedPeople"] : [],
        relatedPeopleFailureCount: failures.length,
        errors: failures.map(({ name, message }) => ({ stage: "relatedPeople", name, message })),
      }),
    );
    return toRelatedPeopleWarning(result.failures);
  });

export const refreshPoiTypes = async (formData: FormData): Promise<AdminActionResult | void> => {
  const result = await poiTypes.refresh(getRequiredString(formData, "poiId", "POI id"));
  revalidatePath("/admin");
  if (result.error) {
    return {
      warning: {
        title: "POI types could not be refreshed",
        description: "Previously saved types remain available when present.",
        details: result.error,
      },
    };
  }
};

export const resolveRelatedPeople = async (formData: FormData) =>
  runAiAction(formData, async (onProgress) => {
    const poiId = getRequiredString(formData, "poiId", "POI id");
    const ai = await getWorkflowAiSelection(formData);
    const result = await withGenerationRun(
      { city: "rome", operation: "relatedPeople.resolve", poiId, ai },
      () => storyWorkflow.relatedPeople.resolve({ poiId, ai, onProgress }),
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
    storyWorkflow.mainImageCandidates.generate({ poiId }),
  );
  revalidatePath("/admin");
};

export const deleteStoryContent = async (formData: FormData) => {
  await storyWorkflow.storyContent.delete({
    poiId: getRequiredString(formData, "poiId", "POI id"),
  });
  revalidatePath("/admin");
};

export const deleteMainImageCandidates = async (formData: FormData) => {
  await storyWorkflow.mainImageCandidates.delete({
    poiId: getRequiredString(formData, "poiId", "POI id"),
  });
  revalidatePath("/admin");
};

export const selectMainImageCandidate = async (formData: FormData) => {
  await storyCuration.selectDraftMainImage({
    poiId: getRequiredString(formData, "poiId", "POI id"),
    commonsFileName: getRequiredString(formData, "commonsFileName", "Commons file name"),
  });
  revalidatePath("/admin");
};
