import { describe, expect, it } from "vitest";
import { withPoiGeneration } from "./poiGeneration";

describe("local POI generation", () => {
  it("rejects duplicates and a fourth operation without queueing, then releases slots", async () => {
    let finish = () => {};
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const started = ["one", "two", "three"].map((id) => withPoiGeneration(id, () => pending));
    try {
      await expect(withPoiGeneration("one", async () => {})).rejects.toThrow(
        "already being generated",
      );
      await expect(withPoiGeneration("four", async () => {})).rejects.toThrow("Three POIs");
    } finally {
      finish();
      await Promise.all(started);
    }
    await expect(withPoiGeneration("one", async () => "done")).resolves.toBe("done");
  });

  it("releases a POI after failure for a manual retry", async () => {
    await expect(
      withPoiGeneration("failed", async () => {
        throw new Error("Stopped");
      }),
    ).rejects.toThrow("Stopped");
    await expect(withPoiGeneration("failed", async () => "retried")).resolves.toBe("retried");
  });
});
