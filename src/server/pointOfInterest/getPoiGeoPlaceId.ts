import { getFeatureId, pickString } from "@/server/wikiPipeline/normalize";
import type { GeoJsonFeature } from "@/server/wikiPipeline/types";

export const getPoiGeoPlaceId = (poi: GeoJsonFeature, geoPlaces: GeoJsonFeature[]) => {
  if (poi.geoPlaceId) return poi.geoPlaceId;
  const name = pickString(poi.properties ?? {}, "name", "name:en", "int_name");
  if (!name || !poi.geometry?.coordinates?.length) return undefined;
  // Older POIs lack source identity. Recover it only from one exact source match.
  const matches = geoPlaces.filter(
    (geoPlace) =>
      poi.geometry?.type === geoPlace.geometry?.type &&
      JSON.stringify(poi.geometry?.coordinates) ===
        JSON.stringify(geoPlace.geometry?.coordinates) &&
      ["name", "name:en", "int_name"].some((key) => geoPlace.properties?.[key] === name),
  );
  return matches.length === 1 ? getFeatureId(matches[0], "") || undefined : undefined;
};
