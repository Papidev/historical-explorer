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

const readCategories = (city = "rome") => createPoiCategoriesForCity(city, dataDirectory).getAll();

beforeEach(() => {
  dataDirectory = mkdtempSync(path.join(tmpdir(), "poi-categories-"));
  writeFileSync(
    path.join(dataDirectory, "poi-type-category-map.json"),
    JSON.stringify({
      version: 1,
      mappings: {
        Q2887138: [],
        Q2065736: [],
        Q16970: ["Church"],
        Q33506: ["Museum"],
        Q124936: ["Basilica"],
        Q2713379: ["Basilica"],
        Q2977: ["Cathedral"],
      },
    }),
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

  it("backfills separate category records without modifying city catalogs or POI identities", () => {
    for (const city of ["rome", "another-city"]) {
      const originalCatalog = readFileSync(catalogPath(city), "utf-8");
      createPoiCategoriesForCity(city, dataDirectory).rebuild();
      expect(readFileSync(catalogPath(city), "utf-8")).toBe(originalCatalog);
      const features = readCatalog(city).features!;
      expect(features).toHaveLength(5);
      expect(features[0]).toMatchObject({
        wikidataId: "Q124154237",
        properties: { name: "Constantinian ruins" },
      });
      expect(readCategories(city)).toEqual({
        "civil-basilica": [],
        "missing-types": [],
        "no-wikidata": [],
        "ignored-type": [],
        "unmapped-type": [],
      });
    }
    const rules = JSON.parse(
      readFileSync(path.join(dataDirectory, "poi-type-category-map.json"), "utf-8"),
    ).mappings;
    expect(rules.Q2887138).toEqual([]);
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
    expect(readCategories()["missing-types"]).toEqual(["Church", "Museum"]);
    typeIds = ["Q33506"];
    await types.refresh("missing-types");
    expect(readCategories()["missing-types"]).toEqual(["Museum"]);
    server.use(
      http.get("https://www.wikidata.org/w/api.php", () => new HttpResponse(null, { status: 503 })),
    );
    await types.refresh("missing-types");
    expect(readCategories()["missing-types"]).toEqual(["Museum"]);
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
    expect(readCategories()["no-wikidata"]).toEqual([]);
    categories.refresh("civil-basilica", []);
    expect(readCategories()["civil-basilica"]).toEqual([]);
  });

  it("maps religious basilica types to the subcategory while ignoring civil basilica types", () => {
    const categories = createPoiCategoriesForCity("rome", dataDirectory);
    categories.refresh("missing-types", [{ id: "Q124936" }, { id: "Q2713379" }]);
    expect(readCategories()["missing-types"]).toEqual(["Basilica"]);
    categories.refresh("civil-basilica", [{ id: "Q2887138" }]);
    expect(readCategories()["civil-basilica"]).toEqual([]);
  });

  it("uses the place name to distinguish basilicas from cathedrals without classifying ignored civil basilicas", () => {
    const rules = {
      cathedral: ["Cathedral"],
      basilica: ["Basilica"],
      church: ["Church"],
      civil: [],
    } satisfies Record<string, import("@/types/PoiCategory").PoiCategory[]>;
    expect(
      derivePoiCategories(
        [{ id: "cathedral" }, { id: "basilica" }],
        rules,
        "Basilica di San Giovanni",
      ),
    ).toEqual(["Basilica"]);
    expect(derivePoiCategories([{ id: "basilica" }], rules, "Cattedrale di Example")).toEqual([
      "Basilica",
      "Cathedral",
    ]);
    expect(derivePoiCategories([{ id: "cathedral" }], rules, "Example Church")).toEqual(["Church"]);
    expect(derivePoiCategories([{ id: "cathedral" }], rules, "Example Cathedral")).toEqual([
      "Cathedral",
    ]);
    expect(derivePoiCategories([{ id: "civil" }], rules, "Basilica of Maxentius")).toEqual([]);
    const categories = createPoiCategoriesForCity("rome", dataDirectory);
    const catalog = readCatalog();
    catalog.features![1].properties = { name: "Basilica di Example" };
    writeFileSync(catalogPath(), JSON.stringify(catalog));
    categories.refresh("missing-types", [{ id: "Q2977" }]);
    expect(readCategories()["missing-types"]).toEqual(["Basilica"]);
  });

  it("keeps other POI assignments intact when one type list is refreshed", () => {
    const originalCatalog = readFileSync(catalogPath(), "utf-8");
    const categories = createPoiCategoriesForCity("rome", dataDirectory);
    expect(categories.getAll()).toEqual({});
    categories.rebuild();
    categories.refresh("ignored-type", [{ id: "Q16970" }]);
    categories.refresh("missing-types", [{ id: "Q33506" }]);
    expect(readCategories()["missing-types"]).toEqual(["Museum"]);
    expect(readCategories()["ignored-type"]).toEqual(["Church"]);
    expect(readCategories()["civil-basilica"]).toEqual([]);
    expect(readFileSync(catalogPath(), "utf-8")).toBe(originalCatalog);
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
    });
    const generated = prepareCatalog("Q124154237", raw, catalog);
    writeFileSync(catalogPath(), JSON.stringify(generated.catalog));
    createPoiCategoriesForCity("rome", dataDirectory).rebuild();
    expect(generated.poiId).toBe("civil-basilica");
    expect(readCategories()[generated.poiId]).toEqual([]);
    expect(readCatalog().features?.find((poi) => poi.id === "present-church")?.wikidataId).toBe(
      "Q1636696",
    );
    expect(readCatalog().features).toHaveLength(6);
    expect(readCatalog().features?.some((poi) => "categories" in poi)).toBe(false);
  });
});

describe("shared curator type mappings", () => {
  it("assigns multiple categories across cities, persists rules and distinguishes clear from ignore", async () => {
    const { createPoiTypeMappings } = await import("@/server/poiTypeMappings");
    const mappings = createPoiTypeMappings(dataDirectory);
    expect(
      mappings.getCatalog().types.find((type) => type.id === "Q999999")?.categories,
    ).toBeUndefined();
    expect(mappings.save("Q999999", ["Church", "Museum", "Church"])).toEqual({
      updatedPois: 2,
      cities: ["another-city", "rome"],
    });
    for (const city of ["rome", "another-city"])
      expect(readCategories(city)["unmapped-type"]).toEqual([
        "Church",
        "Museum",
        "Churches & cathedrals",
      ]);
    expect(
      createPoiTypeMappings(dataDirectory)
        .getCatalog()
        .types.find((type) => type.id === "Q999999")?.categories,
    ).toEqual(["Church", "Museum", "Churches & cathedrals"]);
    for (const city of ["rome", "another-city"])
      createPoiCategoriesForCity(city, dataDirectory).rebuild();
    for (const city of ["rome", "another-city"])
      expect(readCategories(city)["unmapped-type"]).toEqual([
        "Church",
        "Museum",
        "Churches & cathedrals",
      ]);
    mappings.save("Q999999", []);
    expect(mappings.getCatalog().types.find((type) => type.id === "Q999999")?.categories).toEqual(
      [],
    );
    mappings.save("Q999999", null);
    expect(
      mappings.getCatalog().types.find((type) => type.id === "Q999999")?.categories,
    ).toBeUndefined();
    for (const city of ["rome", "another-city"])
      expect(readCategories(city)["unmapped-type"]).toEqual([]);
    expect(mappings.getCatalog().missingTypes).toHaveLength(4);
    expect(readCatalog().features).toHaveLength(5);
  });

  it("preserves unrelated saved categories and Stories, and validates input before writing", async () => {
    const { createPoiTypeMappings } = await import("@/server/poiTypeMappings");
    const mappings = createPoiTypeMappings(dataDirectory);
    const categories = createPoiCategoriesForCity("rome", dataDirectory);
    categories.refresh("ignored-type", [{ id: "Q33506" }]);
    const before = readFileSync(path.join(dataDirectory, "poi-type-category-map.json"), "utf-8");
    expect(() => mappings.save("Q999999", ["Unknown" as never])).toThrow("existing vocabulary");
    expect(() => mappings.save("../../bad", [])).toThrow("Invalid Wikidata");
    expect(() => mappings.save("Q111111", [])).toThrow("no longer present");
    expect(readFileSync(path.join(dataDirectory, "poi-type-category-map.json"), "utf-8")).toBe(
      before,
    );
    mappings.save("Q999999", ["Square"]);
    expect(readCategories()["ignored-type"]).toEqual(["Museum"]);
    writeFileSync(path.join(dataDirectory, "rome", "pois", "categories.json"), "invalid json");
    const saved = readFileSync(path.join(dataDirectory, "poi-type-category-map.json"), "utf-8");
    expect(() => mappings.save("Q999999", ["Museum"])).toThrow();
    expect(readFileSync(path.join(dataDirectory, "poi-type-category-map.json"), "utf-8")).toBe(
      saved,
    );
  });
});

it("keeps Curator rules through a real source-type refresh", async () => {
  const { createPoiTypeMappings } = await import("@/server/poiTypeMappings");
  const mappings = createPoiTypeMappings(dataDirectory);
  mappings.save("Q999999", ["Museum"]);
  server.use(
    http.get("https://www.wikidata.org/w/api.php", ({ request }) => {
      const ids = new URL(request.url).searchParams.get("ids");
      return HttpResponse.json({
        entities:
          ids === "Q300"
            ? {
                Q300: {
                  claims: { P31: [{ mainsnak: { datavalue: { value: { id: "Q999999" } } } }] },
                },
              }
            : { Q999999: { labels: { en: { value: "Refreshed label" } } } },
      });
    }),
  );
  const types = createPoiTypes({
    directory: path.join(dataDirectory, "rome", "generated", "wikidata"),
    findPointOfInterest: (id) => ({
      id,
      name: "Unmapped place",
      city: "Rome",
      coordinates: { lat: 41, lng: 12 },
      sourceHints: { wikidata: "Q300" },
    }),
    onRefresh: createPoiCategoriesForCity("rome", dataDirectory).refresh,
  });
  await types.refresh("unmapped-type");
  expect(readCategories()["unmapped-type"]).toEqual(["Museum"]);
  expect(
    createPoiTypeMappings(dataDirectory)
      .getCatalog()
      .types.find((type) => type.id === "Q999999")?.categories,
  ).toEqual(["Museum"]);
});
