"use client";

import { useEffect, useRef, useState } from "react";
import type { AiProgress } from "@/server/aiProgress";

export const AiProgressLog = ({ runId, isFinished }: { runId: string; isFinished: boolean }) => {
  const [progress, setProgress] = useState<AiProgress>();
  const logRef = useRef<HTMLOListElement>(null);
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(startedAt);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const response = await fetch(`/api/admin/ai-progress/${runId}`, { cache: "no-store" });
        if (response.ok && active) setProgress((await response.json()) as AiProgress);
      } catch {
        // The action may not have created its progress file yet.
      }
    };
    void poll();
    const interval = setInterval(() => {
      setNow(Date.now());
      void poll();
    }, 1_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [runId]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [progress?.entries.length]);

  return (
    <>
      {progress?.status === "partial" ||
      progress?.status === "failed" ||
      progress?.status === "waiting" ? (
        <div
          role="alert"
          className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
            progress.status === "failed"
              ? "border-red-300 bg-red-50 text-red-950"
              : "border-amber-300 bg-amber-50 text-amber-950"
          }`}
        >
          <p className="font-semibold">
            {progress.status === "failed"
              ? "Generation failed"
              : progress.status === "waiting"
                ? "Waiting for a source"
                : "Completed with issues"}
          </p>
          {progress.failedSteps?.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {progress.failedSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1">{progress.entries.at(-1)?.message}</p>
          )}
        </div>
      ) : (
        <p className="mt-1 text-sm text-gray-600">
          {progress?.status === "succeeded"
            ? "Generation completed."
            : isFinished
              ? "Waiting for the final result..."
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
          <li className="text-sm text-gray-500">Starting generation...</li>
        )}
      </ol>
    </>
  );
};
