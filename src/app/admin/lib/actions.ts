"use server";

import { revalidatePath } from "next/cache";
import { pointOfInterest } from "@/server/pointOfInterest";
import { storyCuration } from "@/server/storyCuration";
import { storyWorkflow } from "@/server/storyWorkflow";
import { resolveAiSelection } from "./aiModels";

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

export const generateDraftStory = async (formData: FormData) => {
  const geoPlaceId = getRequiredString(formData, "geoPlaceId", "Geo Place id");
  const ai = await getWorkflowAiSelection(formData);
  const { poiId } = await pointOfInterest.generate({ geoPlaceId });
  await storyWorkflow.draftStory.generate({ poiId, ai });
  revalidatePath("/admin");
};

export const resetDraftStory = async (formData: FormData) => {
  const poiId = getRequiredString(formData, "poiId", "POI id");
  await storyWorkflow.draftStory.reset({ poiId });
  await pointOfInterest.reset({ poiId });
  revalidatePath("/admin");
};

export const refreshAiText = async (formData: FormData) => {
  await storyWorkflow.storyProse.generate({
    poiId: getRequiredString(formData, "poiId", "POI id"),
    ai: await getWorkflowAiSelection(formData),
  });
  revalidatePath("/admin");
};

export const refreshMainImageCandidates = async (formData: FormData) => {
  await storyWorkflow.mainImageCandidates.generate({
    poiId: getRequiredString(formData, "poiId", "POI id"),
  });
  revalidatePath("/admin");
};

export const deleteAiText = async (formData: FormData) => {
  await storyWorkflow.storyProse.delete({
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
    commonsFileName: getRequiredString(
      formData,
      "commonsFileName",
      "Commons file name",
    ),
  });
  revalidatePath("/admin");
};
