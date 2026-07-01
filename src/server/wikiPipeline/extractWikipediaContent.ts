import { fetchWikiSnapshot } from "./fetchWiki";
import {
  buildOutputFilePath,
  findPoiInGeoJson,
  getDefaultInputPath,
  getDefaultOutputDir,
  writeSnapshotFile,
} from "./io";
import { resolvePageForPoi } from "./resolve";
import { wikiTextToPlainText } from "./wikiText";

type ExtractWikipediaContentParams = {
  city: string;
  poiId: string;
};

export const extractWikipediaContent = async ({
  city,
  poiId,
}: ExtractWikipediaContentParams) => {
  console.info(`[wiki] Fetching Wikipedia text for ${poiId}.`);

  const outputDir = getDefaultOutputDir(city);
  const poi = findPoiInGeoJson(getDefaultInputPath(city), poiId, city);
  const outputFilePath = buildOutputFilePath(outputDir, poi.id);
  const resolved = await resolvePageForPoi(poi);
  const snapshot = await fetchWikiSnapshot(resolved.selected.title);

  writeSnapshotFile(outputFilePath, wikiTextToPlainText(snapshot.fullText));

  console.info(
    `[wiki] Saved readable Wikipedia text for ${poiId} to ${outputFilePath}.`,
  );
};
