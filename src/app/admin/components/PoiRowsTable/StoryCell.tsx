import { EyeIcon } from "@heroicons/react/20/solid";
import { ArrowPathIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import { IconButton } from "@/app/components/ui/IconButton";
import { SubmitButton } from "../SubmitButton";
import { ArtifactViewButton } from "./ArtifactViewButton";
import { CellContent } from "./CellContent";
import { CellFooter } from "./CellFooter";
import { PipelineCell } from "./PipelineCell";
import { RelatedPeopleControl } from "./RelatedPeopleControl";
import type { ActionCellProps } from "./RowTypes";

const refreshStoryConfirmMessage = "Refresh Story Content for this POI?";

export const StoryCell = ({
  row,
  actions,
  isInProgress,
  onSelectPanel,
  onViewRelatedPeople,
  runSingleAction,
}: ActionCellProps & { onViewRelatedPeople: (poiId: string) => void }) => (
  <PipelineCell available={Boolean(row.storyContent)} inProgress={isInProgress}>
    <CellContent
      generationModel={[
        row.storyContentGenerationMode,
        row.storyContentGenerationProvider,
        row.storyContentGenerationModel,
      ]
        .filter(Boolean)
        .join(" / ")}
      isAvailable={Boolean(row.storyContent)}
    />
    <RelatedPeopleControl
      row={row}
      actions={actions}
      isInProgress={isInProgress}
      onViewRelatedPeople={onViewRelatedPeople}
      runSingleAction={runSingleAction}
    />
    <CellFooter
      updatedAt={row.storyContentUpdatedAt}
      generationDuration={row.storyContentGenerationDuration}
      updatedAtLabel="Story updated"
      generationDurationLabel="Story generated"
      relatedPeopleUpdatedAt={row.relatedPeopleUpdatedAt}
      relatedPeopleGenerationDuration={row.relatedPeopleGenerationDuration}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {row.storyContent ? (
          <IconButton
            type="button"
            label="View Story Content"
            disabled={isInProgress}
            onClick={() =>
              row.storyContent
                ? onSelectPanel({
                    title: `${row.id} Story Content`,
                    kind: "storyContent",
                    content: row.storyContent,
                    sources: row.storyContentSources ?? [],
                  })
                : null
            }
          >
            <EyeIcon />
          </IconButton>
        ) : null}
        {row.artifacts?.storyContent ? (
          <ArtifactViewButton
            artifact={row.artifacts.storyContent}
            onSelectPanel={onSelectPanel}
            disabled={isInProgress}
          />
        ) : null}
        {row.wikiPoi ? (
          <form
            action={(formData) =>
              runSingleAction(
                row.id,
                "Generating Story Content...",
                actions.refreshStoryContent,
                formData,
                true,
              )
            }
          >
            <input type="hidden" name="poiId" value={row.id} />
            <SubmitButton
              idleLabel={row.storyContent ? "Refresh" : "Generate"}
              pendingLabel="Generating..."
              confirmMessage={refreshStoryConfirmMessage}
              icon={row.storyContent ? <ArrowPathIcon /> : <DocumentTextIcon />}
              tone={row.storyContent ? "danger" : "primary"}
              disabled={isInProgress}
            />
          </form>
        ) : null}
      </div>
    </CellFooter>
  </PipelineCell>
);
