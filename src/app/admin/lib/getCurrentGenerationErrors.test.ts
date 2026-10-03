import { describe, expect, it } from "vitest";
import { getCurrentGenerationErrors } from "./getCurrentGenerationErrors";
import type { GenerationLogEntry } from "@/server/generationRunLog";

const failure: GenerationLogEntry = {
  city: "rome",
  operation: "draftStory.generate",
  geoPlaceId: "Q475012",
  runId: "failed-run",
  at: "2026-10-02T16:33:40.318Z",
  event: "failed",
  errorStage: "storyContent",
  errorCode: "story-content-generation-failed",
  errorMessage: "Expected comma after array element",
};

describe("current generation errors", () => {
  it("hides an old failure when Story Content was subsequently saved", () => {
    expect(
      getCurrentGenerationErrors([failure], {
        storyContent: { completedAt: "2026-10-02T23:00:25.765Z", durationMs: 25613 },
      }),
    ).toEqual([]);
  });

  it("keeps a failed refresh visible when only the previous Story exists", () => {
    expect(
      getCurrentGenerationErrors([failure], {
        storyContent: { completedAt: "2026-10-02T16:00:00.000Z", durationMs: 1 },
      }),
    ).toMatchObject([{ stage: "storyContent", message: failure.errorMessage }]);
  });

  it("keeps errors without a later successful checkpoint", () => {
    expect(getCurrentGenerationErrors([failure])).toHaveLength(1);
    expect(
      getCurrentGenerationErrors([failure], {
        wiki: { completedAt: "2026-10-02T23:00:00.000Z", durationMs: 1 },
      }),
    ).toHaveLength(1);
  });

  it("clears only recovered stages from a partially successful run", () => {
    expect(
      getCurrentGenerationErrors(
        [
          {
            ...failure,
            event: "completed",
            status: "partial",
            errors: [
              { stage: "mainImageCandidates", message: "No images" },
              { stage: "relatedPeople", name: "Person", message: "Unresolved" },
            ],
          },
        ],
        { relatedPeople: { completedAt: "2026-10-02T23:00:00.000Z", durationMs: 1 } },
      ),
    ).toMatchObject([{ stage: "mainImageCandidates", message: "No images" }]);
  });

  it("hides a source failure after later successful source acquisition", () => {
    expect(
      getCurrentGenerationErrors(
        [{ ...failure, errorStage: "sources", errorCode: "source-not-found" }],
        {
          wiki: { completedAt: "2026-10-02T23:00:00.000Z", durationMs: 1 },
        },
      ),
    ).toEqual([]);
  });
  it("clears generic errors after a newer successful run of the same operation", () => {
    expect(
      getCurrentGenerationErrors([
        { ...failure, errorStage: undefined },
        {
          ...failure,
          runId: "successful-run",
          event: "completed",
          status: "success",
          at: "2026-10-02T23:00:00.000Z",
          errors: [],
        },
      ]),
    ).toEqual([]);
  });

  it("keeps failures from unrelated stages despite a successful independent action", () => {
    expect(
      getCurrentGenerationErrors([
        failure,
        {
          ...failure,
          runId: "image-run",
          operation: "mainImageCandidates.generate",
          event: "completed",
          status: "success",
          at: "2026-10-02T23:00:00.000Z",
          errors: [],
        },
      ]),
    ).toHaveLength(1);
  });

  it("clears old POI Types failures only after successful acquisition", () => {
    expect(
      getCurrentGenerationErrors(
        [
          {
            ...failure,
            event: "completed",
            status: "partial",
            errors: [{ stage: "poiTypes", message: "Acquisition failed" }],
          },
        ],
        { poiTypes: { completedAt: "2026-10-02T23:00:00.000Z" } },
      ),
    ).toEqual([]);
  });
});
