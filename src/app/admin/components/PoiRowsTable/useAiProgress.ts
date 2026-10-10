import { useEffect, useState } from "react";
import type { AiProgress } from "@/server/aiProgress";

export const useAiProgress = ({
  runId,
  isFinished,
  outcome,
}: {
  runId: string;
  isFinished: boolean;
  outcome?: Exclude<AiProgress["status"], "running">;
}) => {
  const [progress, setProgress] = useState<AiProgress>();
  const [isLoading, setIsLoading] = useState(true);
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(startedAt);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const poll = async () => {
      let retryFinal = false;
      try {
        const response = await fetch(`/api/admin/ai-progress/${runId}`, { cache: "no-store" });
        if (response.ok) {
          const result = (await response.json()) as AiProgress;
          if (active) setProgress(result);
          retryFinal = result.status === "running" && ++attempts < 3;
        }
      } catch {
        // The action may not have created its progress file yet.
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
  }, [runId, isFinished]);

  return {
    progress,
    isLoading,
    startedAt,
    now,
    isFinished,
    status:
      progress && progress.status !== "running"
        ? progress.status
        : isFinished
          ? outcome
          : "running",
  };
};
