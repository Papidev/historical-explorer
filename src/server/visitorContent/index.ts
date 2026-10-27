import "server-only";
import { getContentPool } from "@/server/content/database";
import { createPostgresContent } from "@/server/content/postgresContent";
import { createCachedRead } from "./cache";

export const visitorContent = {
  getCity: createCachedRead(async (city) =>
    createPostgresContent(getContentPool()).getCityPreviews(city),
  ),
  getStory: createCachedRead(
    async (poiId) => (await createPostgresContent(getContentPool()).getStory(poiId)) ?? null,
  ),
  getPerson: createCachedRead(
    async (personId) => (await createPostgresContent(getContentPool()).getPerson(personId)) ?? null,
  ),
};
