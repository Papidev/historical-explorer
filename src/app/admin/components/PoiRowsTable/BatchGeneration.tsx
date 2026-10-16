import type { RefObject } from "react";
import type { AiSelection } from "../../lib/aiModels";
import type { AdminBatchAction, AdminPoiRow } from "../../lib/types";
import { BatchProgressDialog } from "./BatchProgressDialog";
import { useBatchGeneration } from "./useBatchGeneration";

export const BatchGeneration = ({
  rows,
  aiSelectionRef,
  action,
  disabled,
  onRunningChange,
}: {
  rows: AdminPoiRow[];
  aiSelectionRef: RefObject<Pick<AiSelection, "mode" | "model">>;
  action: AdminBatchAction;
  disabled: boolean;
  onRunningChange: (ids: string[]) => void;
}) => {
  const {
    runs,
    total,
    started,
    error,
    isOpen,
    setIsOpen,
    isRunning,
    isPaused,
    isPausing,
    generate,
    pause,
  } = useBatchGeneration({ rows, aiSelectionRef, action, disabled, onRunningChange });

  return (
    <div className="shrink-0 border-b border-gray-200 px-4 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          onClick={isRunning ? pause : () => void generate()}
          disabled={isRunning ? isPausing : disabled || rows.length === 0}
          title={
            isRunning
              ? "Finish the current POI, then pause"
              : "Generate missing stories one POI at a time"
          }
          className="cursor-pointer rounded-md bg-gray-900 px-3 py-1.5 font-medium text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPausing
            ? "Pausing after current POI..."
            : isRunning
              ? "Pause"
              : "Start automatic generation"}
        </button>
        <p role="status" className="text-gray-600">
          {isRunning
            ? `Generating ${runs.at(-1)?.name ?? "stories"} · ${started} of ${total} POIs processed`
            : total
              ? `${started} of ${total} POIs processed · ${isPaused ? "Paused" : "Finished"}`
              : `${rows.length} POIs without Story Content`}
        </p>
        {runs.length ? (
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => setIsOpen(true)}
            className="cursor-pointer text-violet-700 underline"
          >
            Show generation logs
          </button>
        ) : null}
      </div>
      {error && !isOpen ? (
        <p role="alert" className="mt-2 text-red-700">
          {error}
        </p>
      ) : null}
      {isOpen ? (
        <BatchProgressDialog
          total={total}
          started={started}
          isFinished={!isRunning}
          runs={runs}
          error={error}
          onClose={() => setIsOpen(false)}
        >
          {isRunning ? (
            <button
              type="button"
              onClick={pause}
              disabled={isPausing}
              className="cursor-pointer rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPausing ? "Pausing after current POI..." : "Pause"}
            </button>
          ) : null}
        </BatchProgressDialog>
      ) : null}
    </div>
  );
};
