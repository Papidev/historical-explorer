import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  deleteGenerationCheckpoints,
  replaceGenerationCheckpoint,
} from "@/server/generationMetadata";
import { getDefaultInputPath } from "@/server/wikiPipeline/io";
import { linkWikidata } from "./linkWikidata";
import { prepareCatalog } from "./prepareCatalog";
import type { GeoJson } from "@/server/wikiPipeline/types";

export type PointOfInterestModule = {
  generate(input: { geoPlaceId: string }): Promise<{ poiId: string }>;
  linkWikidata(input: { poiId: string; wikidataId: string }): Promise<void>;
  reset(input: { poiId: string }): Promise<void>;
};

const city = "rome";
const geoPlacesPath = path.join(process.cwd(), "data", city, "pois", "raw.geojson");
const catalogPath = getDefaultInputPath(city);

const parseGeoJson = (filePath: string) => JSON.parse(readFileSync(filePath, "utf-8")) as GeoJson;

const writeCatalog = (catalog: GeoJson) => {
  const temporaryPath = `${catalogPath}.tmp`;
  mkdirSync(path.dirname(catalogPath), { recursive: true });
  writeFileSync(temporaryPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf-8");
  renameSync(temporaryPath, catalogPath);
};

export const pointOfInterest: PointOfInterestModule = {
  generate: async ({ geoPlaceId }) => {
    const startedAt = Date.now();
    const geoPlaces = parseGeoJson(geoPlacesPath);
    const catalog = existsSync(catalogPath)
      ? parseGeoJson(catalogPath)
      : {
          type: geoPlaces.type ?? "FeatureCollection",
          generator: geoPlaces.generator,
          copyright: geoPlaces.copyright,
          timestamp: geoPlaces.timestamp,
          features: [],
        };
    const prepared = prepareCatalog(geoPlaceId, geoPlaces, catalog);
    const { poiId } = prepared;
    writeCatalog(prepared.catalog);
    replaceGenerationCheckpoint(city, poiId, "transformed", {
      durationMs: Date.now() - startedAt,
      completedAt: new Date().toISOString(),
    });

    return { poiId };
  },
  linkWikidata: async ({ poiId, wikidataId }) => {
    writeCatalog(linkWikidata(parseGeoJson(catalogPath), poiId, wikidataId));
  },
  reset: async ({ poiId }) => {
    if (existsSync(catalogPath)) {
      const catalog = parseGeoJson(catalogPath);
      writeCatalog({
        ...catalog,
        features: (catalog.features ?? []).filter((feature) => feature.id !== poiId),
      });
    }
    deleteGenerationCheckpoints(city, poiId, ["transformed"]);
  },
};
