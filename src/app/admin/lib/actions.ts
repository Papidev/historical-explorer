"use server";

import { revalidatePath } from "next/cache";
import { pointOfInterest } from "@/server/pointOfInterest";
import { storyCuration } from "@/server/storyCuration";
import { storyWorkflow } from "@/server/storyWorkflow";
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

  const rateLimited = failures.some(({ message }) => /\b429\b|too many requests/i.test(message));
  return {
    warning: {
      title: "Story saved with unresolved People",
      description: rateLimited
        ? "The Story is available, but an external rate limit interrupted Related People. Retry in a few minutes."
        : "The Story is available, but some Related People could not be resolved.",
      details: failures.map(({ name, message }) => `${name}: ${message}`).join("\n"),
    },
  };
};

export const generateDraftStory = async (formData: FormData) => {
  const geoPlaceId = getRequiredString(formData, "geoPlaceId", "Geo Place id");
  const ai = await getWorkflowAiSelection(formData);
  const { poiId } = await pointOfInterest.generate({ geoPlaceId });
  const result = await storyWorkflow.draftStory.generate({ poiId, ai });
  revalidatePath("/admin");
  return toRelatedPeopleWarning(result.relatedPeopleFailures);
};

export const refreshStoryContent = async (formData: FormData) => {
  const result = await storyWorkflow.storyContent.generate({
    poiId: getRequiredString(formData, "poiId", "POI id"),
    ai: await getWorkflowAiSelection(formData),
  });
  revalidatePath("/admin");
  return toRelatedPeopleWarning(result.failures);
};

export const resolveRelatedPeople = async (formData: FormData) => {
  const result = await storyWorkflow.relatedPeople.resolve({
    poiId: getRequiredString(formData, "poiId", "POI id"),
    ai: await getWorkflowAiSelection(formData),
  });
  revalidatePath("/admin");
  return toRelatedPeopleWarning(result.failures);
};

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
