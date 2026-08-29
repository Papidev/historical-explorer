import { fetchWikiSnapshot } from "./fetchWiki";
import {
  buildOutputFilePath,
  buildSourceMetadataFilePath,
  buildWikipediaPageUrl,
  findPoiInGeoJson,
  getDefaultInputPath,
  getDefaultOutputDir,
  writeSnapshotFile,
  writeSourceMetadataFile,
} from "./io";
import { resolvePageForPoi } from "./resolve";
import { wikiTextToPlainText } from "./wikiText";

type ExtractWikipediaContentParams = {
  city: string;
  poiId: string;
};

export const extractWikipediaContent = async ({ city, poiId }: ExtractWikipediaContentParams) => {
  console.info(`[wiki] Fetching Wikipedia text for ${poiId}.`);

  const outputDir = getDefaultOutputDir(city);
  const poi = findPoiInGeoJson(getDefaultInputPath(city), poiId, city);
  const outputFilePath = buildOutputFilePath(outputDir, poi.id);
  const resolved = await resolvePageForPoi(poi);
  const snapshot = await fetchWikiSnapshot(resolved.selected.title);

  writeSnapshotFile(outputFilePath, wikiTextToPlainText(snapshot.fullText));
  writeSourceMetadataFile(buildSourceMetadataFilePath(outputDir, poi.id), {
    id: "wikipedia",
    kind: "wikipedia",
    title: resolved.selected.title,
    url: buildWikipediaPageUrl(resolved.selected.title),
  });

  console.info(`[wiki] Saved readable Wikipedia text for ${poiId} to ${outputFilePath}.`);
};
