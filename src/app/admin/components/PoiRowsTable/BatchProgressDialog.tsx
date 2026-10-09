import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
} from "@headlessui/react";
import { AiProgressLog } from "./AiProgressLog";
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
    <DialogBackdrop className="fixed inset-0 bg-black/35" />
    <div className="fixed inset-0 flex items-center justify-center p-4">
      <DialogPanel className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
        <DialogTitle className="text-base font-semibold text-gray-900">
          Batch generation
        </DialogTitle>
        {error ? (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        <ul
          aria-label="Batch generation results"
          aria-live="polite"
          className="mt-4 max-h-[60vh] space-y-4 overflow-y-auto text-sm"
        >
          {runs.map((run) => (
            <li key={run.progressId}>
              <span className="font-medium">{run.name}</span>:{" "}
              {run.isFinished
                ? run.error
                  ? "Failed"
                  : run.result?.warning
                    ? "Completed with issues"
                    : "Completed"
                : "Generating..."}
              {run.error || run.result?.warning ? (
                <p className="mt-1 text-xs text-red-700">
                  {run.error ?? run.result?.warning?.description ?? run.result?.warning?.title}
                </p>
              ) : null}
              <Disclosure>
                {({ open }) => (
                  <>
                    <DisclosureButton className="mt-1 cursor-pointer text-xs text-violet-700 underline">
                      {open ? "Hide log" : "Show log"}{" "}
                      <span className="sr-only"> for {run.name}</span>
                    </DisclosureButton>
                    <DisclosurePanel>
                      <AiProgressLog runId={run.progressId} isFinished={run.isFinished} />
                    </DisclosurePanel>
                  </>
                )}
              </Disclosure>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {runs.every(({ isFinished }) => isFinished) ? "Close" : "Hide"}
          </button>
        </div>
      </DialogPanel>
    </div>
  </Dialog>
);
