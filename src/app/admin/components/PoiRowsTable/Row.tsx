import { GeoPlaceCell } from "./GeoPlaceCell";
import { MainImageCell } from "./MainImageCell";
import { PipelineCell } from "./PipelineCell";
import { PoiCell } from "./PoiCell";
import { getPoiRowStatusGroup } from "../../lib/getPoiRowStatusGroup";
import type { ActionCellProps } from "./RowTypes";
import { StoryCell } from "./StoryCell";
import { WikidataTypesCell } from "./WikidataTypesCell";
import { WikipediaCell } from "./WikipediaCell";
import { statusGroupStyles } from "./statusGroupStyles";

export const Row = ({
  row,
  actionsDisabled,
  actions,
  isInProgress,
  progressDescription,
  onSelectPanel,
  runSingleAction,
  selectMainImageCandidateAction,
}: ActionCellProps & {
  actionsDisabled: boolean;
  progressDescription: string | null;
  selectMainImageCandidateAction: (formData: FormData) => Promise<void>;
}) => {
  return (
    <tr
      aria-busy={isInProgress}
      className={
        isInProgress
          ? "shadow-[inset_0_0_0_1px_var(--color-amber-300)]"
          : statusGroupStyles[getPoiRowStatusGroup(row)].row
      }
    >
      <GeoPlaceCell
        row={row}
        actions={actions}
        isInProgress={isInProgress || actionsDisabled}
        progressDescription={progressDescription}
        onSelectPanel={onSelectPanel}
        runSingleAction={runSingleAction}
      />
      <PoiCell
        row={row}
        isInProgress={isInProgress || actionsDisabled}
        onSelectPanel={onSelectPanel}
      />
      <WikipediaCell
        row={row}
        isInProgress={isInProgress || actionsDisabled}
        onSelectPanel={onSelectPanel}
      />
      <WikidataTypesCell
        row={row}
        actions={actions}
        isInProgress={isInProgress || actionsDisabled}
        onSelectPanel={onSelectPanel}
        runSingleAction={runSingleAction}
      />
      {row.sourcePending ? (
        <>
          <PipelineCell inProgress={isInProgress}>{null}</PipelineCell>
          <PipelineCell inProgress={isInProgress}>{null}</PipelineCell>
        </>
      ) : (
        <>
          <StoryCell
            row={row}
            actions={actions}
            isInProgress={isInProgress || actionsDisabled}
            onSelectPanel={onSelectPanel}
            runSingleAction={runSingleAction}
            selectMainImageCandidateAction={selectMainImageCandidateAction}
          />
          <MainImageCell
            row={row}
            actions={actions}
            isInProgress={isInProgress || actionsDisabled}
            onSelectPanel={onSelectPanel}
            runSingleAction={runSingleAction}
          />
        </>
      )}
    </tr>
  );
};
