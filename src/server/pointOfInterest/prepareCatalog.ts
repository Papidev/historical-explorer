import { getFeatureId, pickString, toCitySlug } from "@/server/wikiPipeline/normalize";
import { transformRawPoiFeature } from "@/server/wikiPipeline/transformRawPoiFeature";
import type { GeoJson } from "@/server/wikiPipeline/types";
import { getPoiGeoPlaceId } from "./getPoiGeoPlaceId";

export const prepareCatalog = (geoPlaceId: string, geoPlaces: GeoJson, catalog: GeoJson) => {
  const geoPlaceIndex = (geoPlaces.features ?? []).findIndex(
    (feature, index) =>
      (pickString(feature.properties ?? {}, "wikidata")?.trim() ??
        getFeatureId(feature, `missing-id-${index}`)) === geoPlaceId,
  );
  const geoPlace = geoPlaces.features?.[geoPlaceIndex];
  if (!geoPlace || geoPlaceIndex < 0) throw new Error(`Geo Place ${geoPlaceId} not found.`);
  const sourceId = getFeatureId(geoPlace, `missing-id-${geoPlaceIndex}`);
  const wikidataId = pickString(geoPlace.properties ?? {}, "wikidata")?.trim();
  const features = catalog.features ?? [];
  const existing =
    features.find((feature) => getPoiGeoPlaceId(feature, geoPlaces.features ?? []) === sourceId) ??
    (wikidataId ? features.find((feature) => feature.wikidataId === wikidataId) : undefined);
  const basePoiId =
    toCitySlug(pickString(geoPlace.properties ?? {}, "name:en", "name", "int_name") ?? "") ||
    `poi-${geoPlaceIndex + 1}`;
  let poiId = typeof existing?.id === "string" && existing.id.trim() ? existing.id : basePoiId;
  let suffix = 2;
  while (features.some((feature) => feature !== existing && feature.id === poiId)) {
    poiId = `${basePoiId}-${suffix}`;
    suffix += 1;
  }
  const poi = {
    ...transformRawPoiFeature(geoPlace, { poiId, wikidataId: wikidataId ?? existing?.wikidataId }),
    geoPlaceId: sourceId,
  };
  return {
    poiId,
    catalog: {
      ...catalog,
      features: existing
        ? features.map((feature) => (feature === existing ? poi : feature))
        : [...features, poi],
    },
  };
};
