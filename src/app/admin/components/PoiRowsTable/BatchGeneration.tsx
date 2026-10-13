import { useState } from "react";
import type { RefObject } from "react";
import type { AiSelection } from "../../lib/aiModels";
import type { AdminBatchAction, AdminPoiRow } from "../../lib/types";
import { BatchProgressDialog } from "./BatchProgressDialog";
import { QueueControls } from "./QueueControls";
import { SubmitButton } from "../SubmitButton";
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
  const [limit, setLimit] = useState("20");
  const {
    runs,
    total,
    started,
    error,
    generate,
    isOpen,
    setIsOpen,
    isRunning,
    isPaused,
    isPausing,
    isStopping,
    resume,
    stop,
    savedLimit,
    discard,
  } = useBatchGeneration({ rows, aiSelectionRef, action, disabled, onRunningChange });

  return (
    <div className="border-b border-gray-200 px-4 py-3 text-sm">
      <form
        className="flex flex-wrap items-center gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void generate(Number(limit));
        }}
      >
        <label className="flex items-center gap-2 text-xs text-gray-700">
          Stories per run
          <input
            type="number"
            min={1}
            step={1}
            required
            value={isRunning || isPaused ? String(savedLimit ?? limit) : limit}
            onChange={(event) => setLimit(event.target.value)}
            disabled={isRunning || isPaused}
            className="w-20 rounded-md border border-gray-300 px-2 py-1 disabled:opacity-50"
          />
        </label>
        <SubmitButton
          idleLabel={isRunning ? "Generating stories..." : "Generate missing stories"}
          pendingLabel="Generating stories..."
          disabled={disabled || isRunning || isPaused || rows.length === 0}
        />
        <QueueControls
          isRunning={isRunning}
          isPausing={isPausing}
          isPaused={isPaused}
          isStopping={isStopping}
          disabled={disabled}
          onResume={resume}
          onStop={stop}
        />
      </form>
      <p className="mt-2 text-xs text-gray-500">
        {rows.length} POIs without Story Content, across all pages and filters. Generates one at a
        time; POI errors do not stop the queue.
      </p>
      <p className="mt-1 text-xs text-gray-500">
        POIs that fail before Story Content generation starts do not use the limit.
      </p>
      <p className="mt-1 text-xs text-gray-500">
        The queue is saved in this browser. Reopen this admin page to resume after closing it or
        restarting the computer. Generations pause while the computer is off. The story limit does
        not guarantee an Ollama usage budget.
      </p>
      {isPaused ? (
        <button
          type="button"
          onClick={discard}
          className="mt-2 cursor-pointer text-xs text-gray-600 underline"
        >
          Discard saved queue
        </button>
      ) : null}
      {total ? (
        <p role="status" className="mt-2 text-xs text-gray-600">
          {started} of {total} Story generations completed
          {isPaused ? " · Paused" : isRunning ? " · Running" : " · Finished"}
          {" · "}
          {runs.filter(({ isFinished }) => isFinished).length} POIs processed
        </p>
      ) : null}
      {runs.length ? (
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => setIsOpen(true)}
          className="mt-2 cursor-pointer text-xs text-violet-700 underline"
        >
          Show queue progress
        </button>
      ) : null}
      {error && !isOpen ? (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {error}
        </p>
      ) : null}
      {isOpen ? (
        <BatchProgressDialog
          total={total}
          started={started}
          isFinished={!isRunning && !isPaused}
          runs={runs}
          error={error}
          onClose={() => setIsOpen(false)}
        >
          <QueueControls
            isRunning={isRunning}
            isPausing={isPausing}
            isPaused={isPaused}
            isStopping={isStopping}
            disabled={disabled}
            onResume={resume}
            onStop={stop}
          />
        </BatchProgressDialog>
      ) : null}
    </div>
  );
};
