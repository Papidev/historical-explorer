import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import {
  deleteGenerationCheckpoints,
  replaceGenerationCheckpoint,
} from "@/server/generationMetadata";
import { getDefaultInputPath } from "@/server/wikiPipeline/io";
import { pickString, toCitySlug } from "@/server/wikiPipeline/normalize";
import { transformRawPoiFeature } from "@/server/wikiPipeline/transformRawPoiFeature";
import type { GeoJson, GeoJsonFeature } from "@/server/wikiPipeline/types";

export type PointOfInterestModule = {
  generate(input: { geoPlaceId: string }): Promise<{ poiId: string }>;
  reset(input: { poiId: string }): Promise<void>;
};

const city = "rome";
const geoPlacesPath = path.join(process.cwd(), "data", city, "pois", "raw.geojson");
const catalogPath = getDefaultInputPath(city);

const parseGeoJson = (filePath: string) =>
  JSON.parse(readFileSync(filePath, "utf-8")) as GeoJson;

const writeCatalog = (catalog: GeoJson) => {
  const temporaryPath = `${catalogPath}.tmp`;
  mkdirSync(path.dirname(catalogPath), { recursive: true });
  writeFileSync(temporaryPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf-8");
  renameSync(temporaryPath, catalogPath);
};

const getWikidataId = (feature: GeoJsonFeature) => {
  const value = feature.properties?.wikidata;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
};

const getGeoPlaceId = (feature: GeoJsonFeature, index: number) =>
  getWikidataId(feature) ??
  (typeof feature.id === "string" || typeof feature.id === "number"
    ? String(feature.id)
    : `missing-id-${index}`);

export const pointOfInterest: PointOfInterestModule = {
  generate: async ({ geoPlaceId }) => {
    const startedAt = Date.now();
    const geoPlaces = parseGeoJson(geoPlacesPath);
    const geoPlaceIndex = (geoPlaces.features ?? []).findIndex(
      (feature, index) => getGeoPlaceId(feature, index) === geoPlaceId,
    );
    const geoPlace = geoPlaces.features?.[geoPlaceIndex];
    if (!geoPlace || geoPlaceIndex < 0) {
      throw new Error(`Geo Place ${geoPlaceId} not found.`);
    }

    const catalog = existsSync(catalogPath)
      ? parseGeoJson(catalogPath)
      : {
          type: geoPlaces.type ?? "FeatureCollection",
          generator: geoPlaces.generator,
          copyright: geoPlaces.copyright,
          timestamp: geoPlaces.timestamp,
          features: [],
        };
    const features = catalog.features ?? [];
    const wikidataId = getWikidataId(geoPlace);
    const existing = wikidataId
      ? features.find((feature) => feature.wikidataId === wikidataId)
      : undefined;
    const basePoiId =
      toCitySlug(
        pickString(
          geoPlace.properties ?? {},
          "name:en",
          "name",
          "int_name",
        ) ?? "",
      ) || `poi-${geoPlaceIndex + 1}`;
    let poiId =
      typeof existing?.id === "string" && existing.id.trim()
        ? existing.id
        : basePoiId;
    let suffix = 2;
    while (features.some((feature) => feature !== existing && feature.id === poiId)) {
      poiId = `${basePoiId}-${suffix}`;
      suffix += 1;
    }

    const pointOfInterest = transformRawPoiFeature(geoPlace, {
      poiId,
      wikidataId,
    });
    writeCatalog({
      type: catalog.type ?? "FeatureCollection",
      generator: catalog.generator,
      copyright: catalog.copyright,
      timestamp: catalog.timestamp,
      features: existing
        ? features.map((feature) =>
            feature === existing ? pointOfInterest : feature,
          )
        : [...features, pointOfInterest],
    });
    replaceGenerationCheckpoint(poiId, "transformed", {
      durationMs: Date.now() - startedAt,
      completedAt: new Date().toISOString(),
    });

    return { poiId };
  },
  reset: async ({ poiId }) => {
    if (existsSync(catalogPath)) {
      const catalog = parseGeoJson(catalogPath);
      writeCatalog({
        ...catalog,
        features: (catalog.features ?? []).filter(
          (feature) => feature.id !== poiId,
        ),
      });
    }
    deleteGenerationCheckpoints(poiId, ["transformed"]);
  },
};
