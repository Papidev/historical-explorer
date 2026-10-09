import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
} from "@headlessui/react";
import { ChevronDownIcon } from "@heroicons/react/20/solid";
import clsx from "clsx";
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
              <li
                key={run.progressId}
                className="overflow-hidden rounded-xl border border-gray-200"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4">
                  <span className="min-w-0 flex-1 font-medium break-words text-gray-900">
                    {run.name}
                  </span>
                  <span
                    className={clsx(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                      !run.isFinished
                        ? "bg-violet-50 text-violet-700"
                        : run.error
                          ? "bg-red-50 text-red-700"
                          : run.result?.warning
                            ? "bg-amber-50 text-amber-800"
                            : "bg-emerald-50 text-emerald-700",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={clsx(
                        "size-1.5 rounded-full bg-current",
                        !run.isFinished && "motion-safe:animate-pulse",
                      )}
                    />
                    {run.isFinished
                      ? run.error
                        ? "Failed"
                        : run.result?.warning
                          ? "Completed with issues"
                          : "Completed"
                      : "Generating..."}
                  </span>
                </div>
                {run.error || run.result?.warning ? (
                  <p
                    className={clsx(
                      "mt-2 px-4 text-sm break-words",
                      run.error ? "text-red-700" : "text-amber-800",
                    )}
                  >
                    {run.error ?? run.result?.warning?.description ?? run.result?.warning?.title}
                  </p>
                ) : null}
                <Disclosure>
                  {({ open }) => (
                    <>
                      <DisclosureButton className="mx-4 my-3 inline-flex cursor-pointer items-center gap-1.5 rounded-md px-1 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600">
                        {open ? "Hide log" : "Show log"}{" "}
                        <span className="sr-only"> for {run.name}</span>
                        <ChevronDownIcon
                          aria-hidden="true"
                          className={clsx("size-4 transition-transform", open && "rotate-180")}
                        />
                      </DisclosureButton>
                      <DisclosurePanel className="border-t border-gray-200 bg-gray-50/50 px-4 py-3 [&_[role=log]]:break-words">
                        <AiProgressLog
                          runId={run.progressId}
                          isFinished={run.isFinished}
                          outcome={
                            run.isFinished
                              ? run.error
                                ? "failed"
                                : run.result?.warning
                                  ? "partial"
                                  : "succeeded"
                              : undefined
                          }
                        />
                      </DisclosurePanel>
                    </>
                  )}
                </Disclosure>
              </li>
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
