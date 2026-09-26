"use server";

import { revalidatePath } from "next/cache";
import { pointOfInterest } from "@/server/pointOfInterest";
import { poiTypes } from "@/server/poiTypes";
import { storyCuration } from "@/server/storyCuration";
import { storyWorkflow } from "@/server/storyWorkflow";
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
    if (runId) appendAiProgress(runId, message);
  };

  try {
    const result = await work(onProgress);
    onProgress(result?.warning ? result.warning.title : "AI generation completed.");
    if (runId) finishAiProgress(runId, result?.warning ? "failed" : "succeeded");
    revalidatePath("/admin");
    return result;
  } catch (error) {
    onProgress(`AI generation stopped: ${error instanceof Error ? error.message : String(error)}`);
    if (runId) finishAiProgress(runId, "failed");
    throw error;
  }
};

export const generateDraftStory = async (formData: FormData) =>
  runAiAction(formData, async (onProgress) => {
    const geoPlaceId = getRequiredString(formData, "geoPlaceId", "Geo Place id");
    const ai = await getWorkflowAiSelection(formData);
    onProgress("Creating the Point of Interest.");
    const { poiId } = await pointOfInterest.generate({ geoPlaceId });
    try {
      onProgress("Refreshing POI types.");
      await poiTypes.refresh(poiId);
    } catch (error) {
      console.warn(`[poi-types] Refresh failed for ${poiId}.`, error);
    }
    const result = await storyWorkflow.draftStory.generate({ poiId, ai, onProgress });
    return toRelatedPeopleWarning(result.relatedPeopleFailures);
  });

export const refreshStoryContent = async (formData: FormData) =>
  runAiAction(formData, async (onProgress) => {
    const result = await storyWorkflow.storyContent.generate({
      poiId: getRequiredString(formData, "poiId", "POI id"),
      ai: await getWorkflowAiSelection(formData),
      onProgress,
    });
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
    const result = await storyWorkflow.relatedPeople.resolve({
      poiId: getRequiredString(formData, "poiId", "POI id"),
      ai: await getWorkflowAiSelection(formData),
      onProgress,
    });
    return toRelatedPeopleWarning(result.failures);
  });

export const refreshMainImageCandidates = async (formData: FormData) => {
  await storyWorkflow.mainImageCandidates.generate({
    poiId: getRequiredString(formData, "poiId", "POI id"),
  });
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
