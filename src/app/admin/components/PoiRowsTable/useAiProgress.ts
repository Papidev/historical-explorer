import { useEffect, useState } from "react";
import type { AiProgress } from "@/server/aiProgress";

export const useAiProgress = ({
  runId,
  isFinished,
  outcome,
  connectionLost = false,
}: {
  runId: string;
  isFinished: boolean;
  outcome?: Exclude<AiProgress["status"], "running">;
  connectionLost?: boolean;
}) => {
  const [progress, setProgress] = useState<AiProgress>();
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(startedAt);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const poll = async () => {
      let retryFinal = connectionLost;
      try {
        const response = await fetch(`/api/admin/ai-progress/${runId}`, { cache: "no-store" });
        if (response.ok) {
          const result = (await response.json()) as AiProgress;
          if (active) {
            setProgress(result);
            setHasLoadError(false);
          }
          retryFinal = result.status === "running" && (connectionLost || ++attempts < 3);
        } else if (active) {
          setHasLoadError(response.status !== 404);
        }
      } catch {
        if (active) setHasLoadError(true);
      } finally {
        if (active) {
          setIsLoading(false);
          if (!isFinished || retryFinal)
            timer = setTimeout(() => {
              setNow(Date.now());
              void poll();
            }, 1_000);
        }
      }
    };
    void poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [runId, isFinished, connectionLost]);

  return {
    progress,
    isLoading,
    hasLoadError,
    startedAt,
    now,
    isFinished: connectionLost ? Boolean(progress && progress.status !== "running") : isFinished,
    status:
      progress && progress.status !== "running"
        ? progress.status
        : connectionLost
          ? progress
            ? "running"
            : "unknown"
          : isFinished
            ? outcome
            : "running",
  };
};
