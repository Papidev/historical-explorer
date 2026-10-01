import { getPoiRowStatusGroup } from "../../lib/getPoiRowStatusGroup";
import { EyeIcon } from "@heroicons/react/20/solid";
import { IconButton } from "@/app/components/ui/IconButton";
import { ArtifactViewButton } from "./ArtifactViewButton";
import { CellContent } from "./CellContent";
import { CellFooter } from "./CellFooter";
import { GenerationErrorDetails } from "./GenerationErrorDetails";
import { PipelineCell } from "./PipelineCell";
import type { CellProps } from "./RowTypes";

export const WikipediaCell = ({ row, isInProgress, onSelectPanel }: CellProps) => (
  <PipelineCell
    inProgress={isInProgress}
    needsAttention={getPoiRowStatusGroup(row) === "needs-attention" && !row.wikiPoi}
  >
    <CellContent
      title={!row.wikiPoi ? "Wikipedia source not acquired" : undefined}
      titleTone="warning"
      isAvailable={Boolean(row.wikiPoi)}
    />
    {row.sourcePending ? (
      <p role="status" className="mt-2 text-xs font-semibold text-amber-900">
        Story waiting for an English Wikipedia source
      </p>
    ) : null}
    <GenerationErrorDetails
      errors={(row.generationErrors ?? []).filter(({ stage }) => stage === "sources")}
      label="Source errors"
      latestOnly
    />
    <CellFooter updatedAt={row.wikiUpdatedAt} generationDuration={row.wikiGenerationDuration}>
      {row.wikiPoi ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {row.wikiText?.trim() ? (
            <IconButton
              type="button"
              label="View Wikipedia Text"
              disabled={isInProgress}
              onClick={() =>
                row.wikiText
                  ? onSelectPanel({
                      title: `${row.id} Wikipedia Text`,
                      kind: "text",
                      content: row.wikiText,
                    })
                  : null
              }
            >
              <EyeIcon />
            </IconButton>
          ) : null}
          {row.artifacts?.wikipediaMetadata ? (
            <ArtifactViewButton
              artifact={row.artifacts.wikipediaMetadata}
              onSelectPanel={onSelectPanel}
              disabled={isInProgress}
            />
          ) : null}
        </div>
      ) : null}
    </CellFooter>
  </PipelineCell>
);
