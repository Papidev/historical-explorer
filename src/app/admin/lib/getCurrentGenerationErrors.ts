import type { GenerationMetadata, GenerationStep } from "@/server/generationMetadata";
import type { GenerationLogEntry } from "@/server/generationRunLog";

const checkpointSteps: Record<string, GenerationStep | "poiTypes"> = {
  sources: "wiki",
  poiTypes: "poiTypes",
  mainImageCandidates: "image",
  storyContent: "storyContent",
  relatedPeople: "relatedPeople",
};

export const getCurrentGenerationErrors = (
  runs: GenerationLogEntry[],
  metadata: GenerationMetadata[string] & { poiTypes?: { completedAt: string } } = {},
) =>
  runs.flatMap((run) => {
    const errors =
      run.event === "failed"
        ? [
            {
              stage: run.errorStage ?? "generation",
              message: run.errorMessage ?? run.errorCode ?? "Unknown error",
            },
          ]
        : (run.errors ?? []);
    return errors
      .filter(({ stage }) => {
        const completedAt = metadata[checkpointSteps[stage]]?.completedAt;
        if (completedAt && Date.parse(completedAt) > Date.parse(run.at)) return false;
        return !runs.some(
          (newer) =>
            newer.event === "completed" &&
            newer.status !== "partial" &&
            newer.operation === run.operation &&
            Date.parse(newer.at) > Date.parse(run.at),
        );
      })
      .map((error) => ({ ...error, at: run.at, operation: run.operation }));
  });
