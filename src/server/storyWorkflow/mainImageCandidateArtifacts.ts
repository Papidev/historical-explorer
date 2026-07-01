import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { sanitizePoiIdForFile, toCitySlug } from "../../../scripts/wiki/normalize";
import type { MainImageCandidatesArtifact } from "../../../scripts/wiki/types";

const artifactDirectoryPath = () => path.join(process.cwd(), "data", "wiki-ai");

const sanitizePoiNameForFile = (poiName: string) => toCitySlug(poiName) || "unknown-name";

const getNormalizedPoiIdFromFileName = (fileName: string) =>
  fileName.replace(/\.images\.json$/u, "").split("--")[0] ?? "";

export const buildMainImageCandidateArtifactFileName = (poiId: string, poiName: string) =>
  `${sanitizePoiIdForFile(poiId)}--${sanitizePoiNameForFile(poiName)}.images.json`;

export const buildMainImageCandidateArtifactFilePath = (poiId: string, poiName: string) =>
  path.join(artifactDirectoryPath(), buildMainImageCandidateArtifactFileName(poiId, poiName));

export const listMainImageCandidateArtifactFiles = () =>
  (existsSync(artifactDirectoryPath()) ? readdirSync(artifactDirectoryPath()) : [])
    .filter((fileName) => fileName.endsWith(".images.json"))
    .sort()
    .map((fileName) => ({
      fileName,
      filePath: path.join(artifactDirectoryPath(), fileName),
      poiId: getNormalizedPoiIdFromFileName(fileName),
    }));

export const listMainImageCandidateArtifactFilePathsForPoi = (poiId: string) => {
  const normalizedPoiId = sanitizePoiIdForFile(poiId);

  return listMainImageCandidateArtifactFiles()
    .filter(
      ({ fileName }) =>
        fileName === `${normalizedPoiId}.images.json` ||
        (fileName.startsWith(`${normalizedPoiId}--`) && fileName.endsWith(".images.json")),
    )
    .map(({ filePath }) => filePath);
};

export const readMainImageCandidateArtifact = (poiId: string) => {
  const [filePath] = listMainImageCandidateArtifactFilePathsForPoi(poiId);
  if (!filePath) {
    return undefined;
  }

  return JSON.parse(readFileSync(filePath, "utf-8")) as MainImageCandidatesArtifact;
};
