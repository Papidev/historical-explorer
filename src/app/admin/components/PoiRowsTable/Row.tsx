import type { AdminPoiRow } from "../../lib/types";
import { GeoPlaceCell } from "./GeoPlaceCell";
import { MainImageCell } from "./MainImageCell";
import { PoiCell } from "./PoiCell";
import type { ActionCellProps } from "./RowTypes";
import { StoryCell } from "./StoryCell";
import { WikipediaCell } from "./WikipediaCell";

export const Row = ({
  row,
  actions,
  isInProgress,
  progressDescription,
  onSelectPanel,
  onViewRelatedPeople,
  runSingleAction,
}: ActionCellProps & {
  progressDescription: string | null;
  onViewRelatedPeople: (poiId: AdminPoiRow["id"]) => void;
}) => (
  <tr
    aria-busy={isInProgress}
    className={
      isInProgress ? "shadow-[inset_0_0_0_1px_var(--color-amber-300)]" : "hover:bg-gray-50/60"
    }
  >
    <GeoPlaceCell
      row={row}
      actions={actions}
      isInProgress={isInProgress}
      progressDescription={progressDescription}
      onSelectPanel={onSelectPanel}
      runSingleAction={runSingleAction}
    />
    <PoiCell row={row} isInProgress={isInProgress} onSelectPanel={onSelectPanel} />
    <WikipediaCell row={row} isInProgress={isInProgress} onSelectPanel={onSelectPanel} />
    <StoryCell
      row={row}
      actions={actions}
      isInProgress={isInProgress}
      onSelectPanel={onSelectPanel}
      onViewRelatedPeople={onViewRelatedPeople}
      runSingleAction={runSingleAction}
    />
    <MainImageCell
      row={row}
      actions={actions}
      isInProgress={isInProgress}
      onSelectPanel={onSelectPanel}
      runSingleAction={runSingleAction}
    />
  </tr>
);
