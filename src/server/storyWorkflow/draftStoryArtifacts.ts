import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { buildOutputFilePath } from "@/server/wikiPipeline/io";
import { sanitizePoiIdForFile, toCitySlug } from "@/server/wikiPipeline/normalize";

const artifactDirectoryPath = () => path.join(process.cwd(), "data", "rome", "wiki-ai");

const sanitizePoiNameForFile = (poiName: string) => toCitySlug(poiName) || "unknown-name";

const getNormalizedPoiIdFromFileName = (fileName: string) =>
  fileName.replace(/\.(md|txt)$/u, "").split("--")[0] ?? "";

export const buildDraftStoryArtifactFileName = (poiId: string, poiName: string) =>
  `${sanitizePoiIdForFile(poiId)}--${sanitizePoiNameForFile(poiName)}.md`;

export const buildDraftStoryArtifactFilePath = (poiId: string, poiName: string) =>
  path.join(artifactDirectoryPath(), buildDraftStoryArtifactFileName(poiId, poiName));

export const buildLegacyDraftStoryArtifactFilePath = (poiId: string) =>
  buildOutputFilePath(artifactDirectoryPath(), poiId);

export const listDraftStoryArtifactFiles = () =>
  (existsSync(artifactDirectoryPath()) ? readdirSync(artifactDirectoryPath()) : [])
    .filter((fileName) => fileName.endsWith(".md") || fileName.endsWith(".txt"))
    .sort((left, right) => {
      const leftId = getNormalizedPoiIdFromFileName(left);
      const rightId = getNormalizedPoiIdFromFileName(right);
      if (leftId !== rightId) {
        return leftId.localeCompare(rightId);
      }

      return left.endsWith(".txt") ? -1 : 1;
    })
    .map((fileName) => ({
      fileName,
      filePath: path.join(artifactDirectoryPath(), fileName),
      poiId: getNormalizedPoiIdFromFileName(fileName),
    }));

export const listDraftStoryArtifactFilePathsForPoi = (poiId: string) => {
  const normalizedPoiId = sanitizePoiIdForFile(poiId);

  return listDraftStoryArtifactFiles()
    .filter(
      ({ fileName }) =>
        fileName === `${normalizedPoiId}.md` ||
        fileName === `${normalizedPoiId}.txt` ||
        (fileName.startsWith(`${normalizedPoiId}--`) && fileName.endsWith(".md")),
    )
    .map(({ filePath }) => filePath);
};

export const readCurrentDraftStoryArtifact = (poiId: string) => {
  const normalizedPoiId = sanitizePoiIdForFile(poiId);
  const markdownFile = listDraftStoryArtifactFiles()
    .filter(
      ({ fileName }) =>
        fileName === `${normalizedPoiId}.md` ||
        (fileName.startsWith(`${normalizedPoiId}--`) && fileName.endsWith(".md")),
    )
    .at(-1);
  const legacyFilePath = buildLegacyDraftStoryArtifactFilePath(poiId);
  const filePath = markdownFile?.filePath ?? legacyFilePath;
  if (!existsSync(filePath)) {
    return undefined;
  }

  const content = readFileSync(filePath, "utf-8").trim();
  if (!content) {
    return undefined;
  }

  return { filePath, content };
};
