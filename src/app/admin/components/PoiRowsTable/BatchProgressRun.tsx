import { Disclosure, DisclosureButton, DisclosurePanel } from "@headlessui/react";
import { ChevronDownIcon } from "@heroicons/react/20/solid";
import clsx from "clsx";
import { AiProgressLog } from "./AiProgressLog";
import { useAiProgress } from "./useAiProgress";
import type { useBatchGeneration } from "./useBatchGeneration";

export const BatchProgressRun = ({
  run,
}: {
  run: ReturnType<typeof useBatchGeneration>["runs"][number];
}) => {
  const state = useAiProgress({
    runId: run.progressId,
    isFinished: run.isFinished,
    outcome: run.error ? "failed" : run.result?.warning ? "partial" : "succeeded",
  });
  const { status } = state;
  return (
    <li className="overflow-hidden rounded-xl border border-gray-200">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4">
        <span className="min-w-0 flex-1 font-medium break-words text-gray-900">{run.name}</span>
        <span
          className={clsx(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
            status === "running"
              ? "bg-violet-50 text-violet-700"
              : status === "failed"
                ? "bg-red-50 text-red-700"
                : status === "partial" || status === "waiting"
                  ? "bg-amber-50 text-amber-800"
                  : "bg-emerald-50 text-emerald-700",
          )}
        >
          <span
            aria-hidden="true"
            className={clsx(
              "size-1.5 rounded-full bg-current",
              status === "running" && "motion-safe:animate-pulse",
            )}
          />
          {status === "running"
            ? "Generating..."
            : status === "waiting"
              ? "Waiting for a source"
              : status === "failed"
                ? "Failed"
                : status === "partial"
                  ? "Completed with issues"
                  : "Completed"}
        </span>
      </div>
      {run.error || run.result?.warning ? (
        <p
          className={clsx(
            "mt-2 px-4 text-sm break-words",
            status === "failed" ? "text-red-700" : "text-amber-800",
          )}
        >
          {run.error ?? run.result?.warning?.description ?? run.result?.warning?.title}
        </p>
      ) : null}
      <Disclosure>
        {({ open }) => (
          <>
            <DisclosureButton className="mx-4 my-3 inline-flex cursor-pointer items-center gap-1.5 rounded-md px-1 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600">
              {open ? "Hide log" : "Show log"} <span className="sr-only"> for {run.name}</span>
              <ChevronDownIcon
                aria-hidden="true"
                className={clsx("size-4 transition-transform", open && "rotate-180")}
              />
            </DisclosureButton>
            <DisclosurePanel className="border-t border-gray-200 bg-gray-50/50 px-4 py-3 [&_[role=log]]:break-words">
              <AiProgressLog state={state} />
            </DisclosurePanel>
          </>
        )}
      </Disclosure>
    </li>
  );
};
