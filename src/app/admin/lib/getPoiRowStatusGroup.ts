import type { AdminPoiRow } from "./types";
import { isPoiRowComplete } from "./isPoiRowComplete";

export const getPoiRowStatusGroup = (row: AdminPoiRow) =>
  row.sourcePending
    ? "needs-source"
    : isPoiRowComplete(row)
      ? "complete"
      : row.lastGenerationRun ||
          row.transformedPoi ||
          row.wikiPoi ||
          row.storyContent ||
          row.mainImageArtifact ||
          row.poiTypes ||
          row.generationErrors?.length
        ? "needs-attention"
        : "to-do";
