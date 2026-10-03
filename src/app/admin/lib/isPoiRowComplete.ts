import type { AdminPoiRow } from "./types";

export const isPoiRowComplete = (row: AdminPoiRow) => {
  const selectedImage = row.mainImageArtifact?.candidates.find(
    ({ commonsFileName }) => commonsFileName === row.mainImageArtifact?.selectedCommonsFileName,
  );

  return (
    !row.generationErrors?.length &&
    !row.sourcePending &&
    Boolean(row.transformedPoi && row.poiTypes?.types.length && !row.poiTypes.error) &&
    Boolean(
      row.wikiPoi && row.storyContent && selectedImage?.license && selectedImage.attribution,
    ) &&
    Boolean(row.storyContent?.relatedPeople.every(({ personId }) => personId))
  );
};
