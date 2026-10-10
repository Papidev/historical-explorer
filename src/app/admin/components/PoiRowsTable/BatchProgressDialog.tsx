import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { BatchProgressRun } from "./BatchProgressRun";
import type { useBatchGeneration } from "./useBatchGeneration";

export const BatchProgressDialog = ({
  runs,
  error,
  onClose,
}: {
  runs: ReturnType<typeof useBatchGeneration>["runs"];
  error: string | null;
  onClose: () => void;
}) => (
  <Dialog open onClose={onClose} className="relative z-50">
    <DialogBackdrop className="fixed inset-0 bg-gray-950/40" />
    <div className="fixed inset-0 flex items-center justify-center p-4">
      <DialogPanel className="flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="border-b border-gray-200 px-5 py-5 sm:px-6">
          <DialogTitle className="text-lg font-semibold text-gray-900">
            Batch generation
          </DialogTitle>
          <p className="mt-1 text-sm text-gray-500">
            {runs.filter(({ isFinished }) => isFinished).length} of {runs.length} POIs processed
          </p>
        </div>
        <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6">
          {error ? (
            <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <ul
            aria-label="Batch generation results"
            aria-live="polite"
            className="space-y-3 text-sm"
          >
            {runs.map((run) => (
              <BatchProgressRun key={run.progressId} run={run} />
            ))}
          </ul>
        </div>
        <div className="flex justify-end border-t border-gray-200 bg-gray-50 px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
          >
            {runs.every(({ isFinished }) => isFinished) ? "Close" : "Hide"}
          </button>
        </div>
      </DialogPanel>
    </div>
  </Dialog>
);
