import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { generateStoryBatch } from "./storyBatch";

describe("manual Story batch", () => {
  it("starts all three before completion, preserves independent results, and stops", async () => {
    const started: string[] = [];
    let finish = () => {};
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const runs = ["one", "two", "three"].map((geoPlaceId) => ({
      geoPlaceId,
      progressId: randomUUID(),
    }));
    const batch = generateStoryBatch(runs, async ({ geoPlaceId }) => {
      started.push(geoPlaceId);
      await pending;
      if (geoPlaceId === "two") throw new Error("HTTP 429");
      return geoPlaceId === "three" ? { warning: "Missing image" } : {};
    });
    expect(started).toEqual(["one", "two", "three"]);
    finish();
    expect(await batch).toEqual([
      { ...runs[0], result: {} },
      { ...runs[1], error: "HTTP 429" },
      { ...runs[2], result: { warning: "Missing image" } },
    ]);
    expect(started).toHaveLength(3);
  });

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
