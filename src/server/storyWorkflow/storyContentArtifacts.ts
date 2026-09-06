import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { sanitizePoiIdForFile, toCitySlug } from "@/server/wikiPipeline/normalize";
import { parseStoryContent, parseStoryContentStructure } from "./storyContent";

const storiesDirectoryPath = (city: string) =>
  path.join(process.cwd(), "data", toCitySlug(city), "stories");

export const buildStoryContentFilePath = (city: string, poiId: string) =>
  path.join(storiesDirectoryPath(city), sanitizePoiIdForFile(poiId), "story.json");

export const readStoryContent = (city: string, poiId: string, sourceIds?: string[]) => {
  const filePath = buildStoryContentFilePath(city, poiId);
  if (!existsSync(filePath)) {
    return undefined;
  }

  return {
    filePath,
    content: sourceIds
      ? parseStoryContent(JSON.parse(readFileSync(filePath, "utf-8")), sourceIds)
      : parseStoryContentStructure(JSON.parse(readFileSync(filePath, "utf-8"))),
  };
};
