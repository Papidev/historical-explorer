import { ArrowPathIcon, EyeIcon } from "@heroicons/react/20/solid";
import { IconButton } from "@/app/components/ui/IconButton";
import { SubmitButton } from "../SubmitButton";
import { CellContent } from "./CellContent";
import { CellFooter } from "./CellFooter";
import { PipelineCell } from "./PipelineCell";
import type { ActionCellProps } from "./RowTypes";

export const WikidataTypesCell = ({
  row,
  actions,
  isInProgress,
  onSelectPanel,
  runSingleAction,
}: ActionCellProps) => {
  const types = row.poiTypes?.types ?? [];

  return (
    <PipelineCell available={types.length > 0} inProgress={isInProgress}>
      <CellContent
        title={
          !row.wikidataId
            ? "No Wikidata ID"
            : row.poiTypes?.error
              ? "Acquisition failed"
              : row.poiTypes
                ? types.length > 0
                  ? types
                      .slice(0, 2)
                      .map(({ label }) => label)
                      .join(", ")
                  : "No types"
                : undefined
        }
        subtitle={
          row.poiTypes?.error ??
          (types.length > 0 ? `${types.length} type${types.length === 1 ? "" : "s"}` : undefined)
        }
      />
      <CellFooter>
        <div className="flex flex-wrap items-center gap-1.5">
          {types.length > 0 ? (
            <IconButton
              type="button"
              label="View Wikidata types"
              disabled={isInProgress}
              onClick={() =>
                onSelectPanel({
                  title: `${row.id} Wikidata Types`,
                  kind: "text",
                  content: types.map(({ id, label }) => `${label} (${id})`).join("\n"),
                })
              }
            >
              <EyeIcon />
            </IconButton>
          ) : null}
          {row.transformedPoi && row.wikidataId ? (
            <form
              action={(formData) =>
                runSingleAction(
                  row.id,
                  "Refreshing POI types...",
                  actions.refreshPoiTypes,
                  formData,
                )
              }
            >
              <input type="hidden" name="poiId" value={row.id} />
              <SubmitButton
                idleLabel="Refresh types"
                pendingLabel="Refreshing..."
                icon={<ArrowPathIcon />}
                tone="secondary"
                disabled={isInProgress}
              />
            </form>
          ) : null}
        </div>
      </CellFooter>
    </PipelineCell>
  );
};
