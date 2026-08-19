import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { sanitizePoiIdForFile } from "@/server/wikiPipeline/normalize";

const storiesDirectoryPath = () => path.join(process.cwd(), "data", "rome", "stories");

export const buildStoryFilePath = (poiId: string) =>
  path.join(storiesDirectoryPath(), sanitizePoiIdForFile(poiId), "story.md");

export const listStoryFiles = () =>
  (existsSync(storiesDirectoryPath())
    ? readdirSync(storiesDirectoryPath(), { withFileTypes: true })
    : []
  )
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .flatMap((poiId) => {
      const filePath = buildStoryFilePath(poiId);

      return existsSync(filePath) ? [{ fileName: `${poiId}/story.md`, filePath, poiId }] : [];
    });

export const listStoryFilePathsForPoi = (poiId: string) => {
  const filePath = buildStoryFilePath(poiId);

  return existsSync(filePath) ? [filePath] : [];
};

export const readStory = (poiId: string) => {
  const filePath = buildStoryFilePath(poiId);
  if (!existsSync(filePath)) {
    return undefined;
  }

  const content = readFileSync(filePath, "utf-8").trim();
  if (!content) {
    return undefined;
  }

  return { filePath, content };
};
