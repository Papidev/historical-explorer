import { CodeBracketIcon } from "@heroicons/react/24/outline";
import { IconButton } from "@/app/components/ui/IconButton";
import { CellContent } from "./CellContent";
import { CellFooter } from "./CellFooter";
import { PipelineCell } from "./PipelineCell";
import type { CellProps } from "./RowTypes";

export const PoiCell = ({ row, isInProgress, onSelectPanel }: CellProps) => (
  <PipelineCell available={Boolean(row.transformedPoi)} inProgress={isInProgress}>
    <CellContent subtitle={row.transformedPoi?.id} isAvailable={Boolean(row.transformedPoi)} />
    <CellFooter
      updatedAt={row.transformedUpdatedAt}
      generationDuration={row.transformedGenerationDuration}
    >
      {row.transformedPoi ? (
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
