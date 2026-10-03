import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createPoiTypes } from "@/server/poiTypes";
import { prepareCatalog } from "@/server/pointOfInterest/prepareCatalog";
import type { GeoJson } from "@/server/wikiPipeline/types";
import { createPoiCategoriesForCity, derivePoiCategories } from ".";

const server = setupServer();
let dataDirectory: string;
const catalogPath = (city = "rome") => path.join(dataDirectory, city, "pois", "pois.geojson");
const readCatalog = (city = "rome") =>
  JSON.parse(readFileSync(catalogPath(city), "utf-8")) as GeoJson;

beforeEach(() => {
  dataDirectory = mkdtempSync(path.join(tmpdir(), "poi-categories-"));
  writeFileSync(
    path.join(dataDirectory, "poi-type-category-map.json"),
    readFileSync("data/poi-type-category-map.json"),
  );
  for (const city of ["rome", "another-city"]) {
    mkdirSync(path.dirname(catalogPath(city)), { recursive: true });
    mkdirSync(path.join(dataDirectory, city, "generated", "wikidata"), { recursive: true });
    writeFileSync(
      catalogPath(city),
      JSON.stringify({
        features: [
          {
            id: "civil-basilica",
            wikidataId: "Q124154237",
            properties: { name: "Constantinian ruins" },
          },
          { id: "missing-types", wikidataId: "Q100" },
          { id: "no-wikidata" },
          { id: "ignored-type", wikidataId: "Q200" },
          { id: "unmapped-type", wikidataId: "Q300" },
        ],
      }),
    );
    for (const [id, types] of Object.entries({
      "civil-basilica": ["Q2887138", "Q2887138"],
      "ignored-type": ["Q2065736"],
      "unmapped-type": ["Q999999"],
    })) {
      writeFileSync(
        path.join(dataDirectory, city, "generated", "wikidata", `${id}.json`),
        JSON.stringify({ types: types.map((id) => ({ id, label: id })) }),
      );
    }
  }
  server.listen({ onUnhandledRequest: "error" });
});
afterEach(() => {
  server.close();
  server.resetHandlers();
  rmSync(dataDirectory, { recursive: true, force: true });
});

describe("persisted POI categories", () => {
  it("unions direct type mappings, deduplicating without interpreting labels or ancestors", () => {
    expect(
      derivePoiCategories([{ id: "church" }, { id: "museum" }, { id: "church" }, { id: "child" }], {
        church: ["Church", "Basilica"],
        museum: ["Museum", "Church"],
        ignored: [],
      }),
    ).toEqual(["Church", "Basilica", "Museum"]);
    expect(derivePoiCategories([{ id: "ignored" }, { id: "unmapped" }], { ignored: [] })).toEqual(
      [],
    );
    expect(derivePoiCategories([], { church: ["Church"] })).toEqual([]);
  });

  it("backfills city catalogs and preserves every POI and its identity when types are absent", () => {
    for (const city of ["rome", "another-city"]) {
      createPoiCategoriesForCity(city, dataDirectory).rebuild();
      const features = readCatalog(city).features!;
      expect(features).toHaveLength(5);
      expect(features[0]).toMatchObject({
        wikidataId: "Q124154237",
        categories: ["Basilica"],
        properties: { name: "Constantinian ruins" },
      });
      expect(features.slice(1).map((poi) => poi.categories)).toEqual([[], [], [], []]);
    }
    const rules = JSON.parse(
      readFileSync(path.join(dataDirectory, "poi-type-category-map.json"), "utf-8"),
    ).mappings;
    expect(rules.Q2065736).toEqual([]);
    expect(rules.Q999999).toBeUndefined();
  });

  it("persists the refreshed type union, replaces categories on refresh, and retains categories on acquisition failure", async () => {
    const categories = createPoiCategoriesForCity("rome", dataDirectory);
    let typeIds = ["Q16970", "Q33506"];
    server.use(
      http.get("https://www.wikidata.org/w/api.php", ({ request }) => {
        const ids = new URL(request.url).searchParams.get("ids")!;
        return HttpResponse.json({
          entities:
            ids === "Q100"
              ? {
                  Q100: {
                    claims: {
                      P31: typeIds.map((id) => ({ mainsnak: { datavalue: { value: { id } } } })),
                    },
                  },
                }
              : Object.fromEntries(
                  ids.split("|").map((id) => [id, { labels: { en: { value: id } } }]),
                ),
        });
      }),
    );
    const types = createPoiTypes({
      directory: path.join(dataDirectory, "rome", "generated", "wikidata"),
      findPointOfInterest: (id) => ({
        id,
        name: "Example",
        city: "Rome",
        coordinates: { lat: 41, lng: 12 },
        sourceHints: { wikidata: "Q100" },
      }),
      onRefresh: categories.refresh,
    });
    await types.refresh("missing-types");
    expect(readCatalog().features?.[1].categories).toEqual(["Church", "Museum"]);
    typeIds = ["Q33506"];
    await types.refresh("missing-types");
    expect(readCatalog().features?.[1].categories).toEqual(["Museum"]);
    server.use(
      http.get("https://www.wikidata.org/w/api.php", () => new HttpResponse(null, { status: 503 })),
    );
    await types.refresh("missing-types");
    expect(readCatalog().features?.[1].categories).toEqual(["Museum"]);
  });

  it("clears stale categories when a POI has no Wikidata ID or refreshed types are empty", async () => {
    const categories = createPoiCategoriesForCity("rome", dataDirectory);
    categories.refresh("no-wikidata", [{ id: "Q33506" }]);
    const types = createPoiTypes({
      directory: path.join(dataDirectory, "rome", "generated", "wikidata"),
      findPointOfInterest: (id) => ({
        id,
        name: "Example",
        city: "Rome",
        coordinates: { lat: 41, lng: 12 },
        sourceHints: {},
      }),
      onRefresh: categories.refresh,
    });
    await types.refresh("no-wikidata");
    expect(readCatalog().features?.[2].categories).toEqual([]);
    categories.refresh("civil-basilica", []);
    expect(readCatalog().features?.[0].categories).toEqual([]);
  });

  it("recomputes categories after regeneration without merging the current church and its ruins", () => {
    const raw = {
      features: [
        {
          id: "way/1",
          properties: { name: "Constantinian ruins", wikidata: "Q124154237" },
          geometry: { type: "Point", coordinates: [12, 41] },
        },
      ],
    };
    const catalog = readCatalog();
    catalog.features?.push({
      id: "present-church",
      wikidataId: "Q1636696",
      categories: ["Church"],
    });
    const generated = prepareCatalog("Q124154237", raw, catalog);
    const rebuilt = createPoiCategoriesForCity("rome", dataDirectory).applyToCatalog(
      generated.catalog,
    );
    expect(generated.poiId).toBe("civil-basilica");
    expect(rebuilt.features?.find((poi) => poi.id === generated.poiId)?.categories).toEqual([
      "Basilica",
    ]);
    expect(rebuilt.features?.find((poi) => poi.id === "present-church")?.wikidataId).toBe(
      "Q1636696",
    );
    expect(rebuilt.features).toHaveLength(6);
  });
});
