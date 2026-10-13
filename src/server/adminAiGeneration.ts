import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { writePublicCatalog } from "./publicCatalog/build";
import { withGenerationCancellation, throwIfGenerationCancelled } from "./generationCancellation";
import { sanitizeErrorMessage } from "./generationRunLog";
import { StoryWorkflowError } from "./storyWorkflow";
import {
  aiProgressServerInstance,
  appendAiProgress,
  finishAiProgress,
  markStoryContentStarted,
  readAiProgress,
  startAiProgress,
} from "./aiProgress";
import { generateDraftStory as generateDraftStoryForPoi } from "./draftStoryGeneration";
import { generateStoryBatch } from "./storyBatch";
import { resolveAiSelection } from "@/app/admin/lib/aiModels";
import type { AdminActionResult } from "@/app/admin/lib/types";

export const refreshPublicCatalog = async () => {
  await writePublicCatalog();
  revalidatePath("/rome");
  revalidatePath("/admin");
};

export const runAiAction = async (
  formData: FormData,
  work: (
    onProgress: (message: string) => void,
    onStoryContentStarted: () => void,
  ) => Promise<AdminActionResult | undefined>,
) => {
  if (process.env.NODE_ENV === "production") notFound();

  const progressId = formData.get("progressId");
  const runId = typeof progressId === "string" ? progressId : undefined;
  if (runId) {
    const previous = readAiProgress(runId);
    if (previous?.serverInstance === aiProgressServerInstance) {
      if (previous.status === "running") throw new Error("Generation already active.");
      if (previous.status === "cancelled")
        throw new DOMException("Generation stopped by user.", "AbortError");
      if (previous.status === "failed" || previous.status === "waiting")
        throw new Error(
          previous.error || previous.failedSteps?.join(", ") || "The saved generation failed.",
        );
      return previous.status === "partial"
        ? {
            warning: previous.warning ?? { title: "Completed with issues" },
            failedSteps: previous.failedSteps,
          }
        : undefined;
    }
    startAiProgress(runId);
  }
  const onProgress = (message: string) => {
    throwIfGenerationCancelled();
    if (runId) appendAiProgress(runId, sanitizeErrorMessage(message));
  };

  try {
    const result = await withGenerationCancellation(runId, () =>
      work(onProgress, () => {
        throwIfGenerationCancelled();
        if (runId) markStoryContentStarted(runId);
      }),
    );
    onProgress(result?.warning ? result.warning.title : "AI generation completed.");
    if (runId)
      finishAiProgress(runId, result?.warning ? "partial" : "succeeded", result?.failedSteps, {
        warning: result?.warning
          ? {
              ...result.warning,
              details: result.warning.details
                ? sanitizeErrorMessage(result.warning.details)
                : undefined,
            }
          : undefined,
      });
    return result;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      if (runId) {
        appendAiProgress(runId, "Generation stopped. Saved checkpoints are preserved.");
        finishAiProgress(runId, "cancelled");
      }
      throw error;
    }
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
        { error: sanitizeErrorMessage(error instanceof Error ? error.message : String(error)) },
      );
    throw error;
  } finally {
    await refreshPublicCatalog();
  }
};

export const generateDraftStory = async (formData: FormData) =>
  runAiAction(formData, async (onProgress, onStoryContentStarted) => {
    const geoPlaceId = formData.get("geoPlaceId");
    if (typeof geoPlaceId !== "string" || !geoPlaceId.trim())
      throw new Error("Invalid Geo Place id.");
    const ai = await resolveAiSelection(formData);
    return generateDraftStoryForPoi({
      geoPlaceId: geoPlaceId.trim(),
      ai,
      onProgress,
      onStoryContentStarted,
      resume: formData.get("resume") === "true",
      onCategoriesChanged: (cities) => {
        for (const city of cities) revalidatePath(`/${city}`);
      },
    });
  });

export const generateDraftStories = async (formData: FormData) => {
  if (process.env.NODE_ENV === "production") notFound();

  const ai = await resolveAiSelection(formData);
  const progressIds = formData.getAll("progressId");
  if (progressIds.length !== formData.getAll("geoPlaceId").length) {
    throw new Error("Each selected POI needs a progress ID.");
  }
  const results = await generateStoryBatch(
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
      if (formData.get("resume") === "true") input.set("resume", "true");
      return generateDraftStory(input);
    },
  );
  return results.map((result) => ({
    ...result,
    storyGenerationStarted: readAiProgress(result.progressId)?.storyContentStarted === true,
    cancelled: readAiProgress(result.progressId)?.status === "cancelled",
  }));
};
