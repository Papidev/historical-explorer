import type { GeoJson } from "@/server/wikiPipeline/types";

export const linkWikidata = (catalog: GeoJson, poiId: string, wikidataId: string): GeoJson => {
  if (!/^Q[1-9]\d*$/.test(wikidataId)) throw new Error("Invalid Wikidata ID.");
  const poi = catalog.features?.find((feature) => feature.id === poiId);
  if (!poi) throw new Error(`POI ${poiId} was not found.`);
  if (poi.wikidataId && poi.wikidataId !== wikidataId)
    throw new Error("The Wikipedia page has a conflicting Wikidata ID.");
  return {
    ...catalog,
    features: catalog.features?.map((feature) =>
      feature === poi ? { ...feature, wikidataId } : feature,
    ),
  };
};
