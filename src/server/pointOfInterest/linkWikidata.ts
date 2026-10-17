import type { GeoJson } from "@/server/wikiPipeline/types";
import { isInvalidPoiIdentity } from "@/server/wikiPipeline/isInvalidPoiIdentity";
import { fetchWikimediaJson } from "@/server/wikiPipeline/fetchWikimediaJson";

export const linkWikidata = async (
  catalog: GeoJson,
  poiId: string,
  wikidataId: string,
): Promise<GeoJson> => {
  if (!/^Q[1-9]\d*$/.test(wikidataId)) throw new Error("Invalid Wikidata ID.");
  const poi = catalog.features?.find((feature) => feature.id === poiId);
  if (!poi) throw new Error(`POI ${poiId} was not found.`);
  if (poi.wikidataId && poi.wikidataId !== wikidataId) {
    const url = new URL("https://www.wikidata.org/w/api.php");
    url.searchParams.set("action", "wbgetentities");
    url.searchParams.set("ids", `${poi.wikidataId}|${wikidataId}`);
    url.searchParams.set("props", "info|claims");
    url.searchParams.set("format", "json");
    const data = await fetchWikimediaJson<{
      entities?: Record<
        string,
        {
          id?: string;
          missing?: string;
          claims?: NonNullable<Parameters<typeof isInvalidPoiIdentity>[0]>["claims"];
        }
      >;
    }>(url);
    const previous = data.entities?.[poi.wikidataId];
    const incoming = data.entities?.[wikidataId];
    if (
      !previous?.id ||
      !incoming?.id ||
      previous.missing !== undefined ||
      incoming.missing !== undefined ||
      !/^Q[1-9]\d*$/.test(incoming.id)
    ) {
      throw new Error("Could not verify the conflicting Wikidata identities.");
    }
    if (isInvalidPoiIdentity(incoming))
      throw new Error(
        "A POI cannot be linked to a Wikimedia collection or generic concept.",
      );
    if (previous.id !== incoming.id && !isInvalidPoiIdentity(previous))
      throw new Error("The Wikipedia page has a conflicting Wikidata ID.");
    wikidataId = incoming.id;
  }
  return {
    ...catalog,
    features: catalog.features?.map((feature) =>
      feature === poi ? { ...feature, wikidataId } : feature,
    ),
  };
};
