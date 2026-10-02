import { getPoiRowStatusGroup } from "../../lib/getPoiRowStatusGroup";
import { EyeIcon } from "@heroicons/react/20/solid";
import { ArrowPathIcon, PhotoIcon } from "@heroicons/react/24/outline";
import { IconButton } from "@/app/components/ui/IconButton";
import type { MainImageCandidate, MainImageCandidatesArtifact } from "../../lib/types";
import { SubmitButton } from "../SubmitButton";
import { ArtifactViewButton } from "./ArtifactViewButton";
import { CellContent } from "./CellContent";
import { CellFooter } from "./CellFooter";
import { GenerationErrorDetails } from "./GenerationErrorDetails";
import { MainImageCellPreview, getSelectedMainImageCandidate } from "./MainImageCellPreview";
import { PipelineCell } from "./PipelineCell";
import type { ActionCellProps } from "./RowTypes";

const refreshConfirmMessage = "Refresh Main Image Candidates for this POI?";

const isCandidateSelectable = (candidate: MainImageCandidate) =>
  Boolean(candidate.license && candidate.attribution);

const getMainImageStatus = (artifact?: MainImageCandidatesArtifact) => {
  if (!artifact) {
    return "Image candidates not generated";
  }

  if (artifact.candidates.length === 0) {
    return "No candidates";
  }

  const selectedImage = getSelectedMainImageCandidate(artifact);
  if (selectedImage) {
    if (!selectedImage.license && !selectedImage.attribution)
      return "Missing license and attribution";
    if (!selectedImage.license) return "Missing license";
    if (!selectedImage.attribution) return "Missing attribution";
    return undefined;
  }

  if (artifact.candidates.every((candidate) => !isCandidateSelectable(candidate))) {
    return "Missing license or attribution";
  }

  return "No image selected";
};

export const MainImageCell = ({
  row,
  actions,
  isInProgress,
  onSelectPanel,
  runSingleAction,
}: ActionCellProps) => (
  <PipelineCell
    inProgress={isInProgress}
    needsAttention={
      getPoiRowStatusGroup(row) === "needs-attention" &&
      Boolean(getMainImageStatus(row.mainImageArtifact))
    }
  >
    <div className="flex min-w-0 flex-wrap items-start gap-3">
      <MainImageCellPreview artifact={row.mainImageArtifact} />
      <CellContent
        title={row.sourcePending ? "Waiting for source" : getMainImageStatus(row.mainImageArtifact)}
        titleTone={
          row.sourcePending || getMainImageStatus(row.mainImageArtifact) ? "warning" : "status"
        }
        subtitle={
          row.mainImageArtifact
            ? `${row.mainImageArtifact.candidates.length} candidate${
                row.mainImageArtifact.candidates.length === 1 ? "" : "s"
              }`
            : undefined
        }
        isAvailable={Boolean(getSelectedMainImageCandidate(row.mainImageArtifact))}
      />
    </div>
    <GenerationErrorDetails
      errors={(row.generationErrors ?? []).filter(({ stage }) => stage === "mainImageCandidates")}
      label="Image errors"
      latestOnly
    />
    <CellFooter
      updatedAt={row.mainImageUpdatedAt}
      generationDuration={row.mainImageGenerationDuration}
    >
      {row.mainImageArtifact ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {row.mainImageArtifact.candidates.length > 0 ? (
            <IconButton
              type="button"
              label="View Main Image Candidates"
              disabled={isInProgress}
              onClick={() =>
                row.mainImageArtifact
                  ? onSelectPanel({
                      title: `${row.id} Main Image Candidates`,
                      kind: "mainImage",
                      poiId: row.id,
                      artifact: row.mainImageArtifact,
                    })
                  : null
              }
            >
              <EyeIcon />
            </IconButton>
          ) : null}
          {row.artifacts?.mainImageCandidates ? (
            <ArtifactViewButton
              artifact={row.artifacts.mainImageCandidates}
              onSelectPanel={onSelectPanel}
              disabled={isInProgress}
            />
          ) : null}
          <form
            action={(formData) =>
              runSingleAction(
                row.id,
                "Generating Main Image Candidates...",
                actions.refreshMainImageCandidates,
                formData,
              )
            }
          >
            <input type="hidden" name="poiId" value={row.id} />
            <SubmitButton
              idleLabel="Refresh"
              pendingLabel="Refreshing..."
              confirmMessage={refreshConfirmMessage}
              icon={<ArrowPathIcon />}
              tone="danger"
              disabled={isInProgress}
            />
          </form>
        </div>
      ) : row.transformedPoi && !row.sourcePending ? (
        <form
          action={(formData) =>
            runSingleAction(
              row.id,
              "Generating Main Image Candidates...",
              actions.refreshMainImageCandidates,
              formData,
            )
          }
        >
          <input type="hidden" name="poiId" value={row.id} />
          <SubmitButton
            idleLabel="Generate"
            pendingLabel="Generating..."
            confirmMessage={refreshConfirmMessage}
            icon={<PhotoIcon />}
            tone="primary"
            disabled={isInProgress}
          />
        </form>
      ) : null}
    </CellFooter>
  </PipelineCell>
);
