import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { sanitizePoiIdForFile, toCitySlug } from "@/server/wikiPipeline/normalize";
import type { MainImageCandidatesArtifact } from "@/server/wikiPipeline/types";

const storiesDirectoryPath = (city: string) =>
  path.join(process.cwd(), "data", toCitySlug(city), "stories");

export const buildMainImageCandidateArtifactFilePath = (city: string, poiId: string) =>
  path.join(storiesDirectoryPath(city), sanitizePoiIdForFile(poiId), "images.json");

export const listMainImageCandidateArtifactFiles = (city: string) =>
  (existsSync(storiesDirectoryPath(city))
    ? readdirSync(storiesDirectoryPath(city), { withFileTypes: true })
    : []
  )
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .flatMap((poiId) => {
      const filePath = buildMainImageCandidateArtifactFilePath(city, poiId);

      return existsSync(filePath) ? [{ fileName: `${poiId}/images.json`, filePath, poiId }] : [];
    });

export const listMainImageCandidateArtifactFilePathsForPoi = (city: string, poiId: string) => {
  const filePath = buildMainImageCandidateArtifactFilePath(city, poiId);

  return existsSync(filePath) ? [filePath] : [];
};

export const readMainImageCandidateArtifact = (city: string, poiId: string) => {
  const [filePath] = listMainImageCandidateArtifactFilePathsForPoi(city, poiId);
  if (!filePath) {
    return undefined;
  }

  return JSON.parse(readFileSync(filePath, "utf-8")) as MainImageCandidatesArtifact;
};
