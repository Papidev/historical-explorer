import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { sanitizePoiIdForFile } from "@/server/wikiPipeline/normalize";
import type { MainImageCandidatesArtifact } from "@/server/wikiPipeline/types";

const storiesDirectoryPath = () => path.join(process.cwd(), "data", "rome", "stories");

export const buildMainImageCandidateArtifactFilePath = (poiId: string) =>
  path.join(storiesDirectoryPath(), sanitizePoiIdForFile(poiId), "images.json");

export const listMainImageCandidateArtifactFiles = () =>
  (existsSync(storiesDirectoryPath())
    ? readdirSync(storiesDirectoryPath(), { withFileTypes: true })
    : []
  )
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .flatMap((poiId) => {
      const filePath = buildMainImageCandidateArtifactFilePath(poiId);

      return existsSync(filePath) ? [{ fileName: `${poiId}/images.json`, filePath, poiId }] : [];
    });

export const listMainImageCandidateArtifactFilePathsForPoi = (poiId: string) => {
  const filePath = buildMainImageCandidateArtifactFilePath(poiId);

  return existsSync(filePath) ? [filePath] : [];
};

export const readMainImageCandidateArtifact = (poiId: string) => {
  const [filePath] = listMainImageCandidateArtifactFilePathsForPoi(poiId);
  if (!filePath) {
    return undefined;
  }

  return JSON.parse(readFileSync(filePath, "utf-8")) as MainImageCandidatesArtifact;
};
