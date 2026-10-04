import { describe, expect, it } from "vitest";
import { createPoisForCity } from ".";
import { buildPublicCatalog } from "@/server/publicCatalog/build";
import { createPublicCatalog } from "@/server/publicCatalog";

describe("createPoisForCity", () => {
  it("combines separate persisted categories with POIs by their stable ID", async () => {
    const pois = await createPoisForCity("rome", async () => undefined);
    expect(pois.find(({ id }) => id === "basilica-costantiniana-di-s-agnese")?.categories).toEqual(
      [],
    );
    expect(pois.find(({ id }) => id === "castle-of-the-holy-angel")?.categories).toEqual([
      "Museum",
      "Castle",
      "Mausoleum",
    ]);
    expect(pois.find(({ id }) => id === "acquedotto-dei-sette-bassi")?.categories).toEqual([]);
  });

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

describe("public catalog", () => {
  it("publishes versioned Stories and only their linked People without local sources", async () => {
    const snapshot = await buildPublicCatalog();
    const catalog = createPublicCatalog(() => snapshot);

    expect(catalog.getPois("rome").find(({ id }) => id === "forum-boarium")).toMatchObject({
      name: expect.any(String),
      mainImageUrl: expect.stringContaining("https://"),
    });
    expect(catalog.getStoryContent("rome", "forum-boarium")?.introduction).toContain(
      "Forum Boarium",
    );
    expect(catalog.getStoryContent("rome", "basilica-costantiniana-di-s-agnese")).toBeUndefined();
    expect(catalog.getPerson("pope-alexander-iv")).toBeUndefined();
    for (const { storyContent } of snapshot.pois) {
      for (const { personId } of storyContent.relatedPeople) {
        expect(catalog.getPerson(personId!)).toBeDefined();
      }
    }
    expect(JSON.stringify(snapshot)).not.toMatch(/"(?:sourceIds|generation|isProposed)":/);
  });

  it("returns no content for unknown cities or IDs, including filesystem paths", async () => {
    const snapshot = await buildPublicCatalog();
    const catalog = createPublicCatalog(() => snapshot);

    expect(catalog.getPois("unknown")).toEqual([]);
    expect(catalog.getStoryContent("unknown", "forum-boarium")).toBeUndefined();
    expect(catalog.getStoryContent("rome", "../forum-boarium")).toBeUndefined();
    expect(catalog.getPerson("../people/pope-nicholas-v")).toBeUndefined();
    expect(catalog.getPerson("%2e%2e%2fpeople%2fpope-nicholas-v")).toBeUndefined();
  });
});
