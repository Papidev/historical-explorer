import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { AiProgress } from "@/server/aiProgress";
import type { AiSelection } from "../../lib/aiModels";
import type { AdminBatchAction, AdminBatchResult, AdminPoiRow } from "../../lib/types";
import { getActionError } from "../ActionToast";
import {
  loadStoryQueue,
  saveStoryQueue,
  storyQueueStorageKey,
  type StoryQueue,
} from "./storyQueueStorage";

export const useBatchGeneration = ({
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
  const [runs, setRuns] = useState<StoryQueue["history"]>([]);
  const [total, setTotal] = useState(0);
  const [savedLimit, setSavedLimit] = useState<number>();
  const [started, setStarted] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const mounted = useRef(true);
  const running = useRef(false);
  const pauseRequested = useRef(false);
  const queue = useRef<StoryQueue | null>(null);

  // Browser storage is unavailable during server rendering; restore the external queue after hydration.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    mounted.current = true;
    try {
      const saved = loadStoryQueue();
      if (saved) {
        queue.current = saved;
        setSavedLimit(saved.limit);
        setRuns(saved.history);
        setTotal(Math.min(saved.limit, saved.runs.length));
        setStarted(saved.completed.length);
        setIsPaused(
          Boolean(saved.pendingId) ||
            (saved.index < saved.runs.length &&
              (saved.started < saved.limit ||
                saved.counted.includes(saved.runs[saved.index].geoPlaceId))),
        );
      }
    } catch {
      setError(
        "The saved queue could not be loaded. Browser storage must be available to save a new queue.",
      );
    }
    return () => {
      mounted.current = false;
      pauseRequested.current = true;
    };
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const persistProgress = () => {
    if (!queue.current || !mounted.current) return false;
    try {
      saveStoryQueue(queue.current);
    } catch {
      pauseRequested.current = true;
      setError(
        "The queue could not be saved. New generations are paused to avoid losing progress.",
      );
      return false;
    }
    setRuns([...queue.current.history]);
    setStarted(queue.current.completed.length);
    return true;
  };

  const runQueue = async () => {
    if (running.current || !queue.current) return;
    running.current = true;
    pauseRequested.current = false;
    setIsRunning(true);
    setIsPaused(false);
    setIsPausing(false);
    setError(null);
    const current = queue.current;
    try {
      while (
        mounted.current &&
        !pauseRequested.current &&
        current.index < current.runs.length &&
        (current.pendingId ||
          current.started < current.limit ||
          current.counted.includes(current.runs[current.index].geoPlaceId))
      ) {
        const run = current.runs[current.index];
        onRunningChange([run.geoPlaceId]);
        let result: AdminBatchResult | undefined;
        const recovering = Boolean(current.pendingId);
        if (recovering) {
          try {
            while (mounted.current) {
              const response = await fetch(`/api/admin/ai-progress/${current.pendingId}`, {
                cache: "no-store",
              });
              if (response.status === 404) break;
              if (!response.ok) throw new Error("Could not check the saved generation.");
              const progress = (await response.json()) as AiProgress;
              if (progress.status !== "running") {
                result = {
                  ...run,
                  storyGenerationStarted: progress.storyContentStarted === true,
                  cancelled: progress.status === "cancelled",
                  ...(progress.status === "failed" || progress.status === "waiting"
                    ? {
                        error:
                          progress.error ||
                          progress.failedSteps?.join(", ") ||
                          progress.entries.at(-1)?.message ||
                          "Generation failed.",
                      }
                    : progress.status === "partial"
                      ? {
                          result: {
                            warning: progress.warning ?? {
                              title: "Completed with issues",
                              details: progress.entries.at(-1)?.message,
                            },
                            failedSteps: progress.failedSteps,
                          },
                        }
                      : {}),
                };
                break;
              }
              await new Promise((resolve) => setTimeout(resolve, 1_000));
            }
          } catch {
            pauseRequested.current = true;
            setError(
              "Could not check the saved generation. Resume when the server is available; nothing has been resubmitted.",
            );
            break;
          }
          if (!mounted.current) break;
        }
        if (!result) {
          if (pauseRequested.current) break;
          if (!recovering) current.history.push({ ...run, isFinished: false });
          current.pendingId = run.progressId;
          if (!persistProgress()) break;
          const formData = new FormData();
          formData.set("aiMode", current.ai.mode);
          formData.set("aiModel", current.ai.model);
          formData.set("geoPlaceId", run.geoPlaceId);
          formData.set("progressId", run.progressId);
          if (run.resume || recovering) formData.set("resume", "true");
          try {
            const results = await action(formData);
            result = results.find(({ progressId }) => progressId === run.progressId) ?? {
              ...run,
              error: "Generation returned no result for this POI.",
            };
            if (result.error === "Generation already active.") continue;
            if (typeof BroadcastChannel !== "undefined") {
              const channel = new BroadcastChannel("poi-type-mappings");
              channel.postMessage(["rome"]);
              channel.close();
            }
          } catch (cause) {
            result = {
              ...run,
              error: cause instanceof Error ? cause.message : getActionError(cause).title,
            };
            if (/Failed to fetch|NetworkError|Load failed/i.test(result.error ?? "")) {
              pauseRequested.current = true;
              setError(
                "Connection to the server was lost. Check the run's progress before resuming the queue.",
              );
              current.history = current.history.map((item) =>
                item.progressId === run.progressId
                  ? { ...item, ...result, result: result?.result || undefined, isFinished: true }
                  : item,
              );
              persistProgress();
              break;
            }
          }
        }
        if (!mounted.current) break;
        if (result.storyGenerationStarted !== false && !current.counted.includes(run.geoPlaceId)) {
          current.counted.push(run.geoPlaceId);
          current.started += 1;
        }
        if (result.cancelled) {
          if (!recovering) pauseRequested.current = true;
          current.runs[current.index] = { ...run, progressId: crypto.randomUUID(), resume: true };
        } else {
          current.index += 1;
          if (
            current.counted.includes(run.geoPlaceId) &&
            !current.completed.includes(run.geoPlaceId)
          )
            current.completed.push(run.geoPlaceId);
        }
        current.pendingId = undefined;
        current.history = current.history.map((item) =>
          item.progressId === run.progressId
            ? { ...item, ...result, result: result?.result || undefined, isFinished: true }
            : item,
        );
        if (
          /Ollama[^\n]*HTTP (?:429|402)\b/i.test(
            [result.error, result.result?.warning?.details].filter(Boolean).join("\n"),
          )
        ) {
          pauseRequested.current = true;
          setError("Ollama reported a usage or request limit. Check your usage before resuming.");
        }
        if (!persistProgress()) break;
      }
    } finally {
      running.current = false;
      if (mounted.current) {
        setIsRunning(false);
        setIsPausing(false);
        setIsStopping(false);
        setIsPaused(
          Boolean(current.pendingId) ||
            (current.index < current.runs.length &&
              (current.started < current.limit ||
                current.counted.includes(current.runs[current.index].geoPlaceId))),
        );
        onRunningChange([]);
      }
    }
  };

  const withQueueLock = async (work: () => Promise<void>) => {
    try {
      if (!navigator.locks) return await work();
      await navigator.locks.request(storyQueueStorageKey, { ifAvailable: true }, async (lock) => {
        if (!lock) {
          setError("This queue is running in another browser tab.");
          return;
        }
        await work();
      });
    } catch {
      setError("The saved queue could not be accessed. Check its progress before resuming.");
    }
  };

  const processQueue = () =>
    withQueueLock(async () => {
      const saved = loadStoryQueue();
      if (saved) {
        queue.current = saved;
        setSavedLimit(saved.limit);
        setRuns(saved.history);
        setStarted(saved.completed.length);
        setTotal(Math.min(saved.limit, saved.runs.length));
      }
      await runQueue();
    });

  return {
    runs,
    total,
    started,
    error,
    isOpen,
    setIsOpen,
    isRunning,
    isPaused,
    isPausing,
    isStopping,
    savedLimit,
    discard: async () => {
      if (running.current) return;
      await withQueueLock(async () => {
        localStorage.removeItem(storyQueueStorageKey);
        queue.current = null;
        setSavedLimit(undefined);
        setRuns([]);
        setTotal(0);
        setStarted(0);
        setIsPaused(false);
        setIsOpen(false);
        setError(null);
      });
    },
    stop: async () => {
      if (!running.current || !queue.current || isStopping) return;
      pauseRequested.current = true;
      setIsStopping(true);
      try {
        const response = await fetch(
          `/api/admin/ai-progress/${queue.current.runs[queue.current.index].progressId}/stop`,
          { method: "POST" },
        );
        if (!response.ok) throw new Error("The server could not stop the current generation.");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not request stop.");
        setIsStopping(false);
        setIsPausing(true);
      }
    },
    generate: async (limit: number) => {
      if (disabled || running.current || isPaused || !Number.isSafeInteger(limit) || limit < 1)
        return;
      const selected = rows.flatMap((row) =>
        row.rawPoi && !row.storyContent
          ? [{ geoPlaceId: row.rawPoi.id, name: row.rawPoi.name, progressId: crypto.randomUUID() }]
          : [],
      );
      if (!selected.length) return;
      await withQueueLock(async () => {
        const saved = loadStoryQueue();
        if (
          saved &&
          (saved.pendingId ||
            (saved.index < saved.runs.length &&
              (saved.started < saved.limit ||
                saved.counted.includes(saved.runs[saved.index].geoPlaceId))))
        ) {
          queue.current = saved;
          setSavedLimit(saved.limit);
          setRuns(saved.history);
          setStarted(saved.completed.length);
          setTotal(Math.min(saved.limit, saved.runs.length));
          setIsPaused(true);
          setError(
            "An existing queue was restored. Resume or discard it before starting a new queue.",
          );
          return;
        }
        queue.current = {
          version: 1,
          runs: selected,
          history: [],
          index: 0,
          started: 0,
          counted: [],
          completed: [],
          limit,
          ai: { ...aiSelectionRef.current },
        };
        setSavedLimit(limit);
        if (!persistProgress()) {
          setIsPaused(true);
          return;
        }
        setTotal(Math.min(limit, selected.length));
        setIsOpen(true);
        await runQueue();
      });
    },
    pause: () => {
      pauseRequested.current = true;
      setIsPausing(true);
    },
    resume: async () => {
      if (disabled || !isPaused) return;
      await processQueue();
    },
  };
};
