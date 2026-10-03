import { getPoiRowStatusGroup } from "../../lib/getPoiRowStatusGroup";
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
  if (row.sourcePending && !row.poiTypes) {
    return (
      <PipelineCell inProgress={isInProgress}>
        <CellContent title="Wikidata types not generated" titleTone="neutral" />
      </PipelineCell>
    );
  }
  const types = row.poiTypes?.types ?? [];

  return (
    <PipelineCell
      inProgress={isInProgress}
      needsAttention={
        getPoiRowStatusGroup(row) === "needs-attention" &&
        (types.length === 0 || Boolean(row.poiTypes?.error))
      }
    >
      <div className={types.length > 0 ? "pt-6" : undefined}>
        <CellContent
          title={
            row.transformedPoi &&
            !row.wikidataId &&
            !row.transformedPoi.wikidata &&
            !row.rawPoi?.wikidata &&
            !row.poiTypes
              ? "No Wikidata ID"
              : row.poiTypes?.error
                ? "Acquisition failed"
                : types.length > 0
                  ? types
                      .slice(0, 2)
                      .map(({ label }) => label)
                      .join(", ")
                  : row.poiTypes
                    ? "No Wikidata types found"
                    : "Wikidata types not generated"
          }
          titleTone={
            getPoiRowStatusGroup(row) === "to-do"
              ? "neutral"
              : types.length > 0 && !row.poiTypes?.error
                ? "status"
                : "warning"
          }
          subtitle={
            row.poiTypes?.error ??
            (types.length > 0 ? `${types.length} type${types.length === 1 ? "" : "s"}` : undefined)
          }
        />
      </div>
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
          {row.transformedPoi ? (
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
                confirmMessage="Refresh Wikidata types for this POI? This will replace the saved types."
                icon={<ArrowPathIcon />}
                tone="danger"
                disabled={isInProgress}
              />
            </form>
          ) : null}
        </div>
      </CellFooter>
    </PipelineCell>
  );
};
