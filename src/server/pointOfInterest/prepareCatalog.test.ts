import { describe, expect, it } from "vitest";
import { linkWikidata } from "./linkWikidata";
import { prepareCatalog } from "./prepareCatalog";
import { getPoiGeoPlaceId } from "./getPoiGeoPlaceId";
import type { GeoJson, GeoJsonFeature } from "@/server/wikiPipeline/types";

const geoPlace: GeoJsonFeature = {
  id: "way/997532432",
  properties: { name: "Acquedotto dei Sette Bassi" },
  geometry: { type: "Point", coordinates: [12.5787351, 41.8417417] },
};

const raw: GeoJson = { type: "FeatureCollection", features: [geoPlace] };

describe("POI source identity", () => {
  it("retains a Wikidata ID discovered on Wikipedia through later generation attempts", () => {
    const first = prepareCatalog("way/997532432", raw, { features: [] });
    const linked = linkWikidata(first.catalog, first.poiId, "Q100");
    expect(linked.features?.[0].wikidataId).toBe("Q100");
    const refreshed = prepareCatalog("way/997532432", raw, linked);
    expect(refreshed.catalog.features).toHaveLength(1);
    expect(refreshed.catalog.features?.[0].wikidataId).toBe("Q100");
    expect(refreshed.catalog.features?.[0].geoPlaceId).toBe("way/997532432");
    expect(() => linkWikidata(linked, first.poiId, "Q200")).toThrow("conflicting Wikidata ID");
  });

  it("reuses the same POI for repeated attempts without Wikidata", () => {
    let catalog: GeoJson = { type: "FeatureCollection", features: [] };
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const result = prepareCatalog("way/997532432", raw, catalog);
      catalog = result.catalog;
      expect(result.poiId).toBe("acquedotto-dei-sette-bassi");
      expect(catalog.features).toHaveLength(1);
      expect(catalog.features?.[0].geoPlaceId).toBe("way/997532432");
    }
  });

  it("recovers a legacy POI by exact name and coordinates and keeps its ID", () => {
    const legacy = { ...geoPlace, id: "existing-poi" };
    const result = prepareCatalog("way/997532432", raw, { features: [legacy] });
    expect(result.poiId).toBe("existing-poi");
    expect(result.catalog.features).toHaveLength(1);
    expect(result.catalog.features?.[0].geoPlaceId).toBe("way/997532432");
  });

  it("keeps different same-named Geo Places separate", () => {
    const second: GeoJsonFeature = {
      ...geoPlace,
      id: "way/2",
      geometry: { type: "Point", coordinates: [12.58, 41.85] },
    };
    const places: GeoJson = { features: [geoPlace, second] };
    const first = prepareCatalog("way/997532432", places, { features: [] });
    const next = prepareCatalog("way/2", places, first.catalog);
    expect(next.poiId).toBe("acquedotto-dei-sette-bassi-2");
    expect(next.catalog.features).toHaveLength(2);
    expect(prepareCatalog("way/2", places, next.catalog).catalog.features).toHaveLength(2);
  });

  it("keeps source identity through renaming and coordinate updates", () => {
    const first = prepareCatalog("way/997532432", raw, { features: [] });
    const renamed = {
      ...geoPlace,
      properties: { name: "New name" },
      geometry: { type: "Point", coordinates: [12.5, 41.9] },
    };
    const next = prepareCatalog("way/997532432", { features: [renamed] }, first.catalog);
    expect(next.poiId).toBe(first.poiId);
    expect(next.catalog.features).toHaveLength(1);
    expect(next.catalog.features?.[0].properties?.name).toBe("New name");
  });

  it("keeps existing Wikidata matching while recording the original OpenStreetMap ID", () => {
    const linked = { ...geoPlace, properties: { ...geoPlace.properties, wikidata: "Q100" } };
    const existing = {
      id: "canonical-poi",
      wikidataId: "Q100",
      properties: { name: "Previous name" },
    };
    const next = prepareCatalog("Q100", { features: [linked] }, { features: [existing] });
    expect(next.poiId).toBe("canonical-poi");
    expect(next.catalog.features).toHaveLength(1);
    expect(next.catalog.features?.[0].geoPlaceId).toBe("way/997532432");
  });

  it("does not recover legacy identity from an ambiguous or name-only match", () => {
    const legacy = { ...geoPlace, id: "existing-poi" };
    expect(getPoiGeoPlaceId(legacy, [geoPlace, { ...geoPlace, id: "way/2" }])).toBeUndefined();
    expect(getPoiGeoPlaceId({ ...legacy, geometry: undefined }, [geoPlace])).toBeUndefined();
  });
});
