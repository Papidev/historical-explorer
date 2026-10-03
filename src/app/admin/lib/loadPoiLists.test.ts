import { describe, expect, it } from "vitest";
import { toPoiItems, toPoiRows } from "./loadPoiLists";
import { prepareCatalog } from "@/server/pointOfInterest/prepareCatalog";
import type { GeoJson } from "@/server/wikiPipeline/types";

const raw: GeoJson = {
  features: [
    {
      id: "way/997532432",
      properties: { name: "Acquedotto dei Sette Bassi" },
      geometry: { type: "Point", coordinates: [12.5787351, 41.8417417] },
    },
  ],
};

const rowsFromCatalog = (catalog: GeoJson) =>
  toPoiRows(
    toPoiItems(raw.features, true),
    "Today",
    {},
    (catalog.features ?? []).map((feature) => ({
      item: toPoiItems([feature], false, raw.features)[0],
      json: JSON.stringify(feature),
      updatedAt: "Today",
    })),
    [],
    [],
    [],
  );

describe("admin POI source association", () => {
  it("keeps one linked row across repeated generation attempts without Wikidata", () => {
    let catalog: GeoJson = { features: [] };
    for (let attempt = 0; attempt < 3; attempt += 1) {
      catalog = prepareCatalog("way/997532432", raw, catalog).catalog;
      const rows = rowsFromCatalog(catalog);
      expect(rows).toHaveLength(1);
      expect(rows[0].rawPoi?.id).toBe("way/997532432");
      expect(rows[0].transformedPoi?.id).toBe("acquedotto-dei-sette-bassi");
    }
  });

  it("shows one row for legacy duplicates without deleting catalog records", () => {
    const legacy = { ...raw.features![0], id: "existing-poi" };
    const catalog = { features: [legacy, { ...legacy, id: "existing-poi-2" }] };
    const rows = toPoiRows(
      toPoiItems(raw.features, true),
      "Today",
      {},
      catalog.features.map((feature) => ({
        item: toPoiItems([feature], false, raw.features)[0],
        json: JSON.stringify(feature),
        updatedAt: "Today",
      })),
      [
        {
          item: { id: "existing-poi-2", name: "Example", featureIndex: 0 },
          json: "Saved source",
          updatedAt: "Today",
        },
      ],
      [
        {
          item: { id: "existing-poi-2", name: "Example", featureIndex: 0 },
          storyContent: {
            introduction: { text: "Saved story", sourceIds: ["wikipedia"] },
            topics: { history: [], design: [], art: [] },
            relatedPeople: [],
          },
          sources: [],
          updatedAt: "Today",
        },
      ],
      [
        {
          item: { id: "existing-poi-2", name: "Example", featureIndex: 0 },
          artifact: { candidates: [] },
          updatedAt: "Today",
        },
      ],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].rawPoi?.id).toBe("way/997532432");
    expect(rows[0].transformedPoi?.id).toBe("existing-poi");
    expect(catalog.features).toHaveLength(2);
    expect(prepareCatalog("way/997532432", raw, catalog).poiId).toBe(rows[0].id);
  });
});
