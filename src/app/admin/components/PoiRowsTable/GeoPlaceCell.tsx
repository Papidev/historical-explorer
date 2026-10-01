import { ArrowPathIcon, PlusIcon } from "@heroicons/react/24/outline";
import { SubmitButton } from "../SubmitButton";
import { ArtifactViewButton } from "./ArtifactViewButton";
import { CellContent } from "./CellContent";
import { CellFooter } from "./CellFooter";
import { GenerationErrorDetails } from "./GenerationErrorDetails";
import { PipelineCell } from "./PipelineCell";
import type { ActionCellProps } from "./RowTypes";

const generateConfirmMessage =
  "Generate this row? This will run the complete pipeline: POI, Wikipedia Text, Main Image Candidates, Story Content, and Related People.";
const refreshDraftStoryConfirmMessage =
  "Refresh this row? This will rerun the complete pipeline and replace each generated artifact without deleting the current artifacts first.";

const ProgressMessage = ({ description }: { description: string }) => (
  <div
    role="status"
    className="mt-3 inline-flex w-fit items-center gap-2 rounded-full bg-amber-200 px-2.5 py-1 text-xs font-semibold text-amber-950 shadow-sm"
  >
    <span className="size-2 animate-pulse rounded-full bg-amber-600" aria-hidden="true" />
    <span>{description}</span>
  </div>
);

export const GeoPlaceCell = ({
  row,
  actions,
  isInProgress,
  progressDescription,
  onSelectPanel,
  runSingleAction,
}: ActionCellProps & { progressDescription: string | null }) => {
  const isRowEmpty =
    !row.transformedPoi && !row.wikiPoi && !row.storyContent && !row.mainImageArtifact;

  return (
    <PipelineCell inProgress={isInProgress}>
      <CellContent
        title={row.rawPoi?.name}
        subtitle={row.rawPoi?.wikidata ?? row.rawPoi?.id}
        titleTone="poi"
      />
      {progressDescription ? <ProgressMessage description={progressDescription} /> : null}
      {row.lastGenerationRun ? (
        <p
          title={`${row.lastGenerationRun.operation} · ${row.lastGenerationRun.at}`}
          className={`mt-3 w-fit rounded-full px-2.5 py-1 text-xs font-medium ${
            row.lastGenerationRun.status === "failed" && !row.sourcePending
              ? "bg-red-100 text-red-800"
              : row.lastGenerationRun.status === "success" && !row.sourcePending
                ? "bg-teal-100 text-teal-800"
                : "bg-amber-100 text-amber-900"
          }`}
        >
          Last generation: {row.sourcePending ? "needs source" : row.lastGenerationRun.status}
        </p>
      ) : null}
      {row.sourcePending ? (
        <GenerationErrorDetails
          errors={(row.generationErrors ?? []).filter(({ stage }) => stage === "sources")}
          label="Source errors"
          latestOnly
        />
      ) : null}
      <GenerationErrorDetails
        errors={(row.generationErrors ?? []).filter(
          ({ stage }) =>
            stage !== "sources" &&
            stage !== "storyContent" &&
            stage !== "mainImageCandidates" &&
            stage !== "relatedPeople",
        )}
        latestOnly
      />
      <CellFooter>
        {row.rawPoi ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {row.artifacts?.geoPlace ? (
              <ArtifactViewButton
                artifact={row.artifacts.geoPlace}
                onSelectPanel={onSelectPanel}
                disabled={isInProgress}
              />
            ) : null}
            {isRowEmpty ? (
              <form
                action={(formData) =>
                  runSingleAction(
                    row.id,
                    "Generating Draft Story...",
                    actions.generateDraftStory,
                    formData,
                    true,
                  )
                }
              >
                <input type="hidden" name="geoPlaceId" value={row.rawPoi.id} />
                <SubmitButton
                  idleLabel="Generate"
                  pendingLabel="Generating..."
                  confirmMessage={generateConfirmMessage}
                  icon={<PlusIcon />}
                  tone="primary"
                  disabled={isInProgress}
                />
              </form>
            ) : (
              <form
                action={(formData) =>
                  runSingleAction(
                    row.id,
                    "Refreshing Draft Story...",
                    actions.generateDraftStory,
                    formData,
                    true,
                  )
                }
              >
                <input type="hidden" name="geoPlaceId" value={row.rawPoi.id} />
                <SubmitButton
                  idleLabel="Refresh"
                  pendingLabel="Refreshing..."
                  confirmMessage={refreshDraftStoryConfirmMessage}
                  icon={<ArrowPathIcon />}
                  tone="danger"
                  disabled={isInProgress}
                />
              </form>
            )}
          </div>
        ) : null}
      </CellFooter>
    </PipelineCell>
  );
};
