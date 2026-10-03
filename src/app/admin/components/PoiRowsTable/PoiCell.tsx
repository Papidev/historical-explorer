import { getPoiRowStatusGroup } from "../../lib/getPoiRowStatusGroup";
import { CodeBracketIcon } from "@heroicons/react/24/outline";
import { IconButton } from "@/app/components/ui/IconButton";
import { CellContent } from "./CellContent";
import { CellFooter } from "./CellFooter";
import { PipelineCell } from "./PipelineCell";
import type { CellProps } from "./RowTypes";

export const PoiCell = ({ row, isInProgress, onSelectPanel }: CellProps) => (
  <PipelineCell
    inProgress={isInProgress}
    needsAttention={getPoiRowStatusGroup(row) === "needs-attention" && !row.transformedPoi}
  >
    <CellContent
      title={!row.transformedPoi ? "POI not generated" : undefined}
      titleTone={getPoiRowStatusGroup(row) === "to-do" ? "neutral" : "warning"}
      subtitle={row.transformedPoi?.id}
      isAvailable={Boolean(row.transformedPoi)}
    />
    <CellFooter
      updatedAt={row.transformedUpdatedAt}
      generationDuration={row.transformedGenerationDuration}
    >
      {row.transformedPoi && row.transformedJson?.trim() ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <IconButton
            type="button"
            label="View POI JSON"
            disabled={isInProgress}
            onClick={() =>
              row.transformedJson
                ? onSelectPanel({
                    title: `${row.id} Rome JSON`,
                    kind: "text",
                    content: row.transformedJson,
                  })
                : null
            }
          >
            <CodeBracketIcon />
          </IconButton>
        </div>
      ) : null}
    </CellFooter>
  </PipelineCell>
);
