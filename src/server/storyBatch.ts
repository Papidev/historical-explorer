import { z } from "zod";
import { sanitizeErrorMessage } from "./generationRunLog";

export const generateStoryBatch = async <T>(
  input: unknown,
  generate: (run: { geoPlaceId: string; progressId: string }) => Promise<T>,
) => {
  const runs = z
    .array(
      z.object({
        geoPlaceId: z.string().trim().min(1),
        progressId: z.uuid(),
      }),
    )
    .min(1)
    .max(3)
    .parse(input);
  if (
    new Set(runs.map(({ geoPlaceId }) => geoPlaceId)).size !== runs.length ||
    new Set(runs.map(({ progressId }) => progressId)).size !== runs.length
  ) {
    throw new Error("Select distinct POIs and progress IDs.");
  }

  return Promise.all(
    runs.map(async (run) => {
      try {
        return { ...run, result: await generate(run) };
      } catch (error) {
        return {
          ...run,
          error: sanitizeErrorMessage(error instanceof Error ? error.message : String(error)),
        };
      }
    }),
  );
};
