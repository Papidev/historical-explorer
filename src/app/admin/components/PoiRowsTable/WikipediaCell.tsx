import { EyeIcon } from "@heroicons/react/20/solid";
import { IconButton } from "@/app/components/ui/IconButton";
import { ArtifactViewButton } from "./ArtifactViewButton";
import { CellContent } from "./CellContent";
import { CellFooter } from "./CellFooter";
import { PipelineCell } from "./PipelineCell";
import type { CellProps } from "./RowTypes";

export const WikipediaCell = ({ row, isInProgress, onSelectPanel }: CellProps) => (
  <PipelineCell available={Boolean(row.wikiPoi)} inProgress={isInProgress}>
    <CellContent isAvailable={Boolean(row.wikiPoi)} />
    <CellFooter updatedAt={row.wikiUpdatedAt} generationDuration={row.wikiGenerationDuration}>
      {row.wikiPoi ? (
        <div className="flex flex-wrap items-center gap-1.5">
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
