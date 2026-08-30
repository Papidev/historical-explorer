import { describe, expect, it } from "vitest";
import { createPoisForCity } from ".";

describe("createPoisForCity", () => {
  it("includes the selected main image in the public POI data", async () => {
    const pois = await createPoisForCity("rome");

    expect(pois.find(({ id }) => id === "forum-boarium")?.mainImageUrl).toBe(
      "https://upload.wikimedia.org/wikipedia/commons/5/52/SoutherCircusFlaminiusInRomeByGismondi.jpg",
    );
    expect(
      pois.find(({ id }) => id === "basilica-costantiniana-di-s-agnese")?.previewDescription,
    ).toContain("The Constantinian Basilica of Saint Agnes");
    expect(
      pois.find(({ id }) => id === "basilica-costantiniana-di-s-agnese")?.shortDescription,
    ).toBeUndefined();
  });
});
