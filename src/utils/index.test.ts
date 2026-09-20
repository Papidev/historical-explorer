import { describe, expect, it } from "vitest";
import { createPoisForCity } from ".";

describe("createPoisForCity", () => {
  it("includes selected images without inventing missing preview copy", async () => {
    const pois = await createPoisForCity("rome", async (poiId) =>
      poiId === "forum-boarium"
        ? {
            poiId,
            sources: [],
            mainImageCandidates: [],
            draftMainImage: {
              commonsFileName: "forum-boarium.jpg",
              commonsPageUrl: "https://commons.wikimedia.org/wiki/File:forum-boarium.jpg",
              thumbnailUrl:
                "https://upload.wikimedia.org/wikipedia/commons/5/52/SoutherCircusFlaminiusInRomeByGismondi.jpg",
              originalImageUrl:
                "https://upload.wikimedia.org/wikipedia/commons/5/52/SoutherCircusFlaminiusInRomeByGismondi.jpg",
              discoveredVia: "wikidata-p18",
              isProposed: true,
            },
            generation: {},
          }
        : undefined,
    );

    expect(pois.find(({ id }) => id === "forum-boarium")?.mainImageUrl).toBe(
      "https://upload.wikimedia.org/wikipedia/commons/5/52/SoutherCircusFlaminiusInRomeByGismondi.jpg",
    );
    expect(
      pois.find(({ id }) => id === "basilica-costantiniana-di-s-agnese")?.previewDescription,
    ).toBeUndefined();
    expect(
      pois.find(({ id }) => id === "basilica-costantiniana-di-s-agnese")?.shortDescription,
    ).toBeUndefined();
  });
});
