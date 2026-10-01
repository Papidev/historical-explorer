import type { AdminPoiRow } from "./types";
import { isPoiRowComplete } from "./isPoiRowComplete";

export const getPoiRowStatusGroup = (row: AdminPoiRow) =>
  row.sourcePending
    ? "needs-source"
    : row.lastGenerationRun?.status === "failed" || row.lastGenerationRun?.status === "partial"
      ? "needs-attention"
      : isPoiRowComplete(row)
        ? "complete"
        : "to-do";
