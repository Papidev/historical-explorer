import { describe, expect, it } from "vitest";
import { loadPoiLists, toPoiItems, toPoiRows } from "./loadPoiLists";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
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
  it("loads POIs with incomplete generation checkpoints and retains their latest date", async () => {
    const directory = realpathSync(mkdtempSync(path.join(tmpdir(), "admin-poi-checkpoints-")));
    const originalWorkingDirectory = process.cwd();
    const originalLocalDataDirectory = process.env.HISTORICAL_EXPLORER_LOCAL_DATA_DIR;
    try {
      process.chdir(directory);
      process.env.HISTORICAL_EXPLORER_LOCAL_DATA_DIR = path.join(directory, "local");
      mkdirSync("data/rome/pois", { recursive: true });
      writeFileSync("data/rome/pois/raw.geojson", JSON.stringify(raw));
      writeFileSync(
        "data/rome/pois/pois.geojson",
        JSON.stringify({
          features: [{ ...raw.features![0], id: "aqueduct", geoPlaceId: "way/997532432" }],
        }),
      );
      mkdirSync("local/rome/generated", { recursive: true });
      writeFileSync(
        "local/rome/generated/generation-metadata.json",
        JSON.stringify({
          aqueduct: {
            wiki: { completedAt: "2026-10-16T18:00:00.000Z", durationMs: 1 },
            relatedPeople: { completedAt: "2026-10-16T19:00:00.000Z", durationMs: 1 },
          },
        }),
      );

      const result = await loadPoiLists();
      expect(result.error).toBeNull();
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toMatchObject({
        id: "aqueduct",
        lastGenerationAt: "2026-10-16T19:00:00.000Z",
      });
    } finally {
      process.chdir(originalWorkingDirectory);
      if (originalLocalDataDirectory === undefined)
        delete process.env.HISTORICAL_EXPLORER_LOCAL_DATA_DIR;
      else process.env.HISTORICAL_EXPLORER_LOCAL_DATA_DIR = originalLocalDataDirectory;
      rmSync(directory, { recursive: true, force: true });
    }
  });

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
