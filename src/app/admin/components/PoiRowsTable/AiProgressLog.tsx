"use client";

import { useEffect, useRef } from "react";
import type { useAiProgress } from "./useAiProgress";

export const AiProgressLog = ({
  state: { progress, isLoading, startedAt, now, status, isFinished },
}: {
  state: ReturnType<typeof useAiProgress>;
}) => {
  const logRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [progress?.entries.length]);

  return (
    <>
      {status === "partial" || status === "failed" || status === "waiting" ? (
        <div
          role="alert"
          className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
            status === "failed"
              ? "border-red-300 bg-red-50 text-red-950"
              : "border-amber-300 bg-amber-50 text-amber-950"
          }`}
        >
          <p className="font-semibold">
            {status === "failed"
              ? "Generation failed"
              : status === "waiting"
                ? "Waiting for a source"
                : "Completed with issues"}
          </p>
          {progress?.failedSteps?.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {progress.failedSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          ) : progress?.entries.length ? (
            <p className="mt-1">{progress.entries.at(-1)?.message}</p>
          ) : null}
        </div>
      ) : (
        <p className="mt-1 text-sm text-gray-600">
          {status === "succeeded"
            ? "Generation completed."
            : isFinished
              ? "Generation finished."
              : `Working for ${Math.floor((now - (progress ? new Date(progress.startedAt).getTime() : startedAt)) / 1_000)} seconds.`}
        </p>
      )}
      <ol
        ref={logRef}
        role="log"
        aria-live="polite"
        className="mt-4 max-h-72 space-y-2 overflow-y-auto rounded-lg bg-gray-50 p-3"
      >
        {progress?.entries.length ? (
          progress.entries.map(({ at, message }, index) => (
            <li key={`${at}-${index}`} className="flex gap-3 text-sm text-gray-800">
              <time className="shrink-0 font-mono text-xs text-gray-500">
                {new Date(at).toLocaleTimeString()}
              </time>
              <span>{message}</span>
            </li>
          ))
        ) : (
          <li className="text-sm text-gray-500">
            {isLoading
              ? "Loading generation log..."
              : isFinished
                ? "Generation log unavailable."
                : "Starting generation..."}
          </li>
        )}
      </ol>
    </>
  );
};
