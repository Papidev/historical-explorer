import type { PublishedCityPreview } from "@/server/content/publishedContent";
import type { createPublicCatalog } from "@/server/publicCatalog";
import type { Poi } from "@/types/Poi";
import { toVisitorCity } from "./adapters";

export const matchesPoiIdentity = (
  local: Pick<Poi, "id" | "wikidataId">,
  online: { id: string; wikidataId?: string | null },
) => local.id === online.id || Boolean(local.wikidataId && local.wikidataId === online.wikidataId);

export const mergeVisitorCity = (
  online: PublishedCityPreview,
  local: Pick<ReturnType<typeof createPublicCatalog>, "getPois" | "getCategoryDefinitions">,
) => {
  const city = toVisitorCity(online);
  const aliases: Record<string, string> = {};
  const localPois = local.getPois(online.city).filter((poi) => {
    const published = online.pois.find((candidate) => matchesPoiIdentity(poi, candidate));
    if (published) aliases[poi.id] = published.id;
    return !published && !online.removedPois?.some((removed) => matchesPoiIdentity(poi, removed));
  });
  const categories = new Map(
    local.getCategoryDefinitions().map((category) => [category.id, category]),
  );
  for (const category of city.categoryDefinitions)
    categories.set(category.id, { ...categories.get(category.id), ...category });
  return {
    pois: [...city.pois, ...localPois],
    categoryDefinitions: [...categories.values()],
    aliases,
  };
};
