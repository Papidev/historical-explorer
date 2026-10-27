import { describe, expect, it } from "vitest";
import type { PublishedCityPreview } from "@/server/content/publishedContent";
import type { Poi } from "@/types/Poi";
import { mergeVisitorCity } from "./mergeCity";

const online: PublishedCityPreview = {
  city: "rome",
  categoryDefinitions: [{ id: "architecture", name: "Online architecture" }],
  pois: [
    {
      id: "8aa5be62-82a6-4776-a2cd-bc5b1be60996",
      wikidataId: "Q10285",
      city: "rome",
      name: "Online Colosseum",
      categoryIds: ["architecture"],
      coordinates: { lat: 41.89, lng: 12.49 },
      introduction: "An online introduction.",
      mainImage: null,
    },
  ],
};
const colosseum: Poi = {
  id: "colosseum",
  wikidataId: "Q10285",
  city: "rome",
  name: "Local Colosseum",
  coordinates: { lat: 41.89, lng: 12.49 },
  mainImageUrl: "https://example.com/local.jpg",
  funFacts: [],
};
const castle: Poi = {
  ...colosseum,
  id: "castle",
  wikidataId: "Q193887",
  name: "Castel Sant’Angelo",
  categories: ["castle"],
};
const local = {
  getPois: () => [colosseum, castle],
  getCategoryDefinitions: () => [
    { id: "architecture", name: "Local architecture" },
    { id: "castle", name: "Castle", parent: "architecture" },
  ],
};

describe("incremental visitor catalog", () => {
  it("keeps local-only POIs, selects the complete online version and resolves legacy links", () => {
    const merged = mergeVisitorCity(online, local);
    expect(merged.pois.map(({ id }) => id)).toEqual([online.pois[0].id, "castle"]);
    expect(merged.pois[0]).toMatchObject({
      name: "Online Colosseum",
      categories: ["architecture"],
      previewDescription: "An online introduction.",
    });
    expect(merged.pois[0].mainImageUrl).toBeUndefined();
    expect(merged.aliases.colosseum).toBe(online.pois[0].id);
    expect(merged.categoryDefinitions).toEqual([
      { id: "architecture", name: "Online architecture" },
      { id: "castle", name: "Castle", parent: "architecture" },
    ]);
  });

  it("does not resurrect a confirmed online removal from local content", () => {
    const merged = mergeVisitorCity(
      { ...online, pois: [], removedPois: [{ id: online.pois[0].id, wikidataId: "Q10285" }] },
      local,
    );
    expect(merged.pois.map(({ id }) => id)).toEqual(["castle"]);
  });

  it("deduplicates an identical UUID even when there is no Wikidata identity", () => {
    expect(
      mergeVisitorCity(online, {
        ...local,
        getPois: () => [{ ...colosseum, id: online.pois[0].id, wikidataId: undefined }],
      }).pois,
    ).toHaveLength(1);
  });
});
