import type { RefObject } from "react";
import type { AiSelection } from "../../lib/aiModels";
import type { AdminBatchAction, AdminPoiRow } from "../../lib/types";
import { BatchProgressDialog } from "./BatchProgressDialog";
import { SubmitButton } from "../SubmitButton";
import { useBatchGeneration } from "./useBatchGeneration";

export const BatchGeneration = ({
  rows,
  aiSelectionRef,
  action,
  disabled,
  onRunningChange,
  onShowLog,
}: {
  rows: AdminPoiRow[];
  aiSelectionRef: RefObject<Pick<AiSelection, "mode" | "model">>;
  action: AdminBatchAction;
  disabled: boolean;
  onRunningChange: (ids: string[]) => void;
  onShowLog: (runId: string, title: string, isFinished: boolean) => void;
}) => {
  const { runs, error, generate, isOpen, setIsOpen } = useBatchGeneration({
    rows,
    aiSelectionRef,
    action,
    disabled,
    onRunningChange,
  });

  return (
    <div className="border-b border-gray-200 px-4 py-3 text-sm">
      <form className="flex flex-wrap items-center gap-3" action={generate}>
        <SubmitButton
          idleLabel="Generate next 3"
          pendingLabel="Generating batch..."
          disabled={disabled || rows.length === 0 || rows.length > 3}
        />
        <span className="text-xs text-gray-500">
          Generates the first 3 To do POIs matching your search and filters.
        </span>
      </form>
      {rows.length ? (
        <p className="mt-2 text-xs text-gray-600">
          Next: {rows.map((row) => row.rawPoi?.name).join(", ")}
        </p>
      ) : null}
      {runs.length ? (
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => setIsOpen(true)}
          className="mt-2 cursor-pointer text-xs text-violet-700 underline"
        >
          Show batch progress
        </button>
      ) : null}
      {isOpen ? (
        <BatchProgressDialog
          runs={runs}
          error={error}
          onClose={() => setIsOpen(false)}
          onShowLog={(runId, title, isFinished) => {
            setIsOpen(false);
            onShowLog(runId, title, isFinished);
          }}
        />
      ) : null}
    </div>
  );
};
