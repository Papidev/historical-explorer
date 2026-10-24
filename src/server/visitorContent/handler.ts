import { z } from "zod";
import type {
  PublishedCityPreview,
  PublishedPerson,
  PublishedPoiDetail,
} from "@/server/content/publishedContent";
import type { createPublicCatalog } from "@/server/publicCatalog";
import type { PublicStoryContent } from "@/server/storyWorkflow/storyContent";
import { matchesPoiIdentity } from "./mergeCity";
import { toVisitorPerson, toVisitorStory } from "./adapters";

export const createVisitorHandler = (
  reads: {
    getCity?: (city: string) => Promise<PublishedCityPreview>;
    getStory: (id: string) => Promise<PublishedPoiDetail | null>;
    getPerson: (id: string) => Promise<PublishedPerson | null>;
  },
  local?: ReturnType<typeof createPublicCatalog>,
) => {
  const getStory = async (
    city: string,
    poiId: string,
  ): Promise<{ storyContent: PublicStoryContent; detail: PublishedPoiDetail | null } | null> => {
    const localPoi = local?.getPois(city).find(({ id }) => id === poiId);
    if (localPoi) {
      // Establish online ownership before considering the local version. Failures never select it.
      if (!reads.getCity) throw new Error("Online city read is required.");
      const online = await reads.getCity(city);
      if (online.removedPois?.some((removed) => matchesPoiIdentity(localPoi, removed))) return null;
      const published = online.pois.find((candidate) => matchesPoiIdentity(localPoi, candidate));
      if (!published) {
        const storyContent = local?.getStoryContent(city, poiId);
        return storyContent ? { storyContent, detail: null } : null;
      }
      poiId = published.id;
    }
    if (!z.uuid().safeParse(poiId).success) return null;
    const detail = await reads.getStory(poiId);
    return detail && detail.city === city ? { storyContent: toVisitorStory(detail), detail } : null;
  };

  return {
    getStory: async (city: string, poiId: string) => {
      const headers = { "Cache-Control": "no-store" };
      try {
        const content = await getStory(city, poiId);
        return Response.json(content ?? { storyContent: null }, {
          status: content ? 200 : 404,
          headers,
        });
      } catch {
        return Response.json({ storyContent: null }, { status: 503, headers });
      }
    },
    getPerson: async (personId: string, city?: string, poiId?: string) => {
      const headers = { "Cache-Control": "no-store" };
      try {
        if (city && poiId) {
          const parent = await getStory(city, poiId);
          if (!parent?.storyContent.relatedPeople.some((person) => person.personId === personId))
            return Response.json({ person: null }, { status: 404, headers });
          if (!parent.detail) {
            const person = local?.getPerson(personId) ?? null;
            return Response.json({ person, detail: null }, { status: person ? 200 : 404, headers });
          }
        }
        const detail = await reads.getPerson(personId);
        return Response.json(
          { person: detail ? toVisitorPerson(detail) : null, detail },
          { status: detail ? 200 : 404, headers },
        );
      } catch {
        return Response.json({ person: null }, { status: 503, headers });
      }
    },
  };
};
