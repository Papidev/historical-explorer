import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { sanitizePoiIdForFile } from "@/server/wikiPipeline/normalize";
import { parseStoryContent, parseStoryContentStructure } from "./storyContent";

const storiesDirectoryPath = () => path.join(process.cwd(), "data", "rome", "stories");

export const buildStoryContentFilePath = (poiId: string) =>
  path.join(storiesDirectoryPath(), sanitizePoiIdForFile(poiId), "story.json");

export const readStoryContent = (poiId: string, sourceIds?: string[]) => {
  const filePath = buildStoryContentFilePath(poiId);
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
