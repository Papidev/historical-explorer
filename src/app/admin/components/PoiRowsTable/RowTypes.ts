import type { AdminAction, AdminPoiRow } from "../../lib/types";
import type { SelectedPanel } from "./Preview";

export type Actions = {
  generateDraftStory: AdminAction;
  refreshPoiTypes: AdminAction;
  refreshStoryContent: AdminAction;
  resolveRelatedPeople: AdminAction;
  refreshMainImageCandidates: AdminAction;
};

export type CellProps = {
  row: AdminPoiRow;
  isInProgress: boolean;
  onSelectPanel: (panel: SelectedPanel) => void;
};

export type ActionCellProps = CellProps & {
  actions: Actions;
  runSingleAction: (
    poiId: string,
    description: string,
    action: AdminAction,
    formData: FormData,
    includeAiSelection?: boolean,
  ) => Promise<void>;
};
