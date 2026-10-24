import { describe, expect, it } from "vitest";
import { createPublicCatalog } from "@/server/publicCatalog";
import type { PublishedCityPreview } from "@/server/content/publishedContent";
import { exampleStoryWrite } from "@/server/content/__fixtures__/writes";
import { createVisitorHandler } from "./handler";

describe("visitor APIs", () => {
  const write = exampleStoryWrite();
  const handler = createVisitorHandler({
    getStory: async (id) => (id === write.detail.id ? write.detail : null),
    getPerson: async (id) => (id === "vespasian" ? write.people[0].person : null),
  });

  it("returns online Markdown, image metadata and Source citations with no browser cache", async () => {
    const response = await handler.getStory("rome", write.detail.id);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toMatchObject({
      storyContent: { introduction: "A Roman amphitheatre.", textFormat: "markdown" },
      detail: {
        publicationId: write.detail.publicationId,
        gallery: [],
        mainImageId: null,
        sources: write.detail.sources,
      },
    });
  });

  it("does not fall back to a legacy slug, missing publication or another city's Story", async () => {
    for (const [city, id] of [
      ["rome", "colosseum"],
      ["rome", "00000000-0000-4000-8000-000000000001"],
      ["paris", write.detail.id],
    ]) {
      const response = await handler.getStory(city, id);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ storyContent: null });
    }
  });

  it("returns saved People and hides missing/unlinked People", async () => {
    expect(await (await handler.getPerson("vespasian")).json()).toMatchObject({
      person: { id: "vespasian", textFormat: "markdown" },
      detail: { linkedPois: [{ id: write.detail.id }] },
    });
    expect((await handler.getPerson("legacy-only-person")).status).toBe(404);
  });

  it("returns unavailable on storage failure without connection details or stale content", async () => {
    const unavailable = createVisitorHandler({
      getStory: async () => {
        throw new Error("database credential");
      },
      getPerson: async () => {
        throw new Error("database credential");
      },
    });
    for (const response of [
      await unavailable.getStory("rome", write.detail.id),
      await unavailable.getPerson("vespasian"),
    ]) {
      expect(response.status).toBe(503);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(await response.text()).not.toContain("credential");
    }
  });
});

describe("local-only POI fallback", () => {
  const write = exampleStoryWrite();
  const localStory = {
    introduction: "Local Story",
    topics: { history: [], design: [], art: [] },
    relatedPeople: [{ personId: "vespasian", name: "Local Vespasian" }],
  };
  const localPerson = {
    id: "vespasian",
    name: "Local Vespasian",
    description: ["Local biography.", "Local context."] as [string, string],
    curiosities: [],
  };
  const local = createPublicCatalog(() => ({
    version: 1,
    city: "rome",
    categoryDefinitions: [],
    pois: [
      {
        poi: {
          id: "colosseum",
          wikidataId: "Q10285",
          name: "Local Colosseum",
          city: "rome",
          coordinates: { lat: 41.89, lng: 12.49 },
          funFacts: [],
        },
        storyContent: localStory,
        mainImage: {
          thumbnailUrl: "https://example.com/image.jpg",
          originalImageUrl: "https://example.com/image.jpg",
          commonsPageUrl: "https://commons.wikimedia.org/wiki/File:Image.jpg",
          attribution: "Local photographer",
          license: "CC0",
        },
      },
    ],
    people: [localPerson],
  }));
  const onlinePoi = {
    id: write.detail.id,
    wikidataId: "Q10285",
    city: "rome",
    name: "Colosseum",
    coordinates: write.detail.coordinates,
    categoryIds: [],
    mainImage: null,
    introduction: "Online Story",
  };
  const city: PublishedCityPreview = { city: "rome", pois: [], categoryDefinitions: [] };

  it("serves the local Story and local People when the POI is not published online", async () => {
    const handler = createVisitorHandler(
      { getCity: async () => city, getStory: async () => null, getPerson: async () => null },
      local,
    );
    expect(await (await handler.getStory("rome", "colosseum")).json()).toEqual({
      storyContent: localStory,
      detail: null,
    });
    expect(await (await handler.getPerson("vespasian", "rome", "colosseum")).json()).toEqual({
      person: localPerson,
      detail: null,
    });
    expect((await handler.getPerson("unrelated-person", "rome", "colosseum")).status).toBe(404);
  });

  it("resolves legacy aliases to online content and never fills gaps with the local version", async () => {
    let detail: typeof write.detail | null = write.detail;
    const handler = createVisitorHandler(
      {
        getCity: async () => ({ ...city, pois: [onlinePoi] }),
        getStory: async () => detail,
        getPerson: async () => null,
      },
      local,
    );
    expect(await (await handler.getStory("rome", "colosseum")).json()).toMatchObject({
      detail: { id: write.detail.id },
      storyContent: { introduction: "A Roman amphitheatre." },
    });
    expect((await handler.getPerson("vespasian", "rome", "colosseum")).status).toBe(404);
    detail = null;
    expect((await handler.getStory("rome", "colosseum")).status).toBe(404);
  });

  it("does not use local content on a database failure or confirmed removal", async () => {
    const removed = createVisitorHandler(
      {
        getCity: async () => ({
          ...city,
          removedPois: [{ id: write.detail.id, wikidataId: "Q10285" }],
        }),
        getStory: async () => null,
        getPerson: async () => null,
      },
      local,
    );
    expect((await removed.getStory("rome", "colosseum")).status).toBe(404);
    const unavailable = createVisitorHandler(
      {
        getCity: async () => {
          throw new Error("unavailable");
        },
        getStory: async () => null,
        getPerson: async () => null,
      },
      local,
    );
    expect((await unavailable.getStory("rome", "colosseum")).status).toBe(503);
  });
});
