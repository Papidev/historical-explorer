import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { AiSelection } from "../../lib/aiModels";
import type { AdminBatchAction, AdminBatchResult, AdminPoiRow } from "../../lib/types";
import { getActionError } from "../ActionToast";

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
  const [runs, setRuns] = useState<(AdminBatchResult & { name: string; isFinished: boolean })[]>(
    [],
  );
  const [total, setTotal] = useState(0);
  const [started, setStarted] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const mounted = useRef(true);
  const running = useRef(false);
  const pauseRequested = useRef(false);
  const queue = useRef<{
    remaining: { geoPlaceId: string; name: string }[];
    ai: Pick<AiSelection, "mode" | "model">;
  } | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      pauseRequested.current = true;
    };
  }, []);

  const generate = async () => {
    if (disabled || running.current) return;
    if (!isPaused || !queue.current) {
      queue.current = {
        remaining: rows.flatMap((row) =>
          row.rawPoi && !row.storyContent
            ? [{ geoPlaceId: row.rawPoi.id, name: row.rawPoi.name }]
            : [],
        ),
        ai: { ...aiSelectionRef.current },
      };
      setRuns([]);
      setStarted(0);
      setTotal(queue.current.remaining.length);
    } else {
      // A POI may have been generated individually while automatic generation was paused.
      const previousRemaining = queue.current.remaining.length;
      queue.current.remaining = queue.current.remaining.filter(({ geoPlaceId }) =>
        rows.some((row) => row.rawPoi?.id === geoPlaceId && !row.storyContent),
      );
      setTotal(total - previousRemaining + queue.current.remaining.length);
    }
    const current = queue.current;
    if (!current.remaining.length) {
      setIsPaused(false);
      return;
    }
    running.current = true;
    pauseRequested.current = false;
    setIsRunning(true);
    setIsPaused(false);
    setIsPausing(false);
    setError(null);
    const process = async () => {
      while (mounted.current && !pauseRequested.current && current.remaining.length) {
        const run = { ...current.remaining[0], progressId: crypto.randomUUID() };
        onRunningChange([run.geoPlaceId]);
        setRuns((previous) => [...previous, { ...run, isFinished: false }]);
        const formData = new FormData();
        formData.set("aiMode", current.ai.mode);
        formData.set("aiModel", current.ai.model);
        formData.set("geoPlaceId", run.geoPlaceId);
        formData.set("progressId", run.progressId);
        let result: AdminBatchResult;
        try {
          result = (await action(formData)).find(
            ({ progressId }) => progressId === run.progressId,
          ) ?? {
            ...run,
            error: "Generation returned no result for this POI.",
          };
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
        }
        if (!mounted.current) break;
        current.remaining.shift();
        setStarted((previous) => previous + 1);
        setRuns((previous) =>
          previous.map((item) =>
            item.progressId === run.progressId ? { ...item, ...result, isFinished: true } : item,
          ),
        );
        if (result.cancelled) {
          pauseRequested.current = true;
          setError("Generation was interrupted. Check this POI’s log before starting again.");
        } else if (
          /Failed to fetch|NetworkError|Load failed|Generation already active/i.test(
            result.error ?? "",
          )
        ) {
          pauseRequested.current = true;
          setError(
            "Connection or generation status is uncertain. Check this POI's log before starting again.",
          );
        } else if (
          /Ollama[^\n]*HTTP (?:429|402)\b/i.test(
            [result.error, result.result?.warning?.details].filter(Boolean).join("\n"),
          )
        ) {
          pauseRequested.current = true;
          setError(
            "Ollama reported a usage or request limit. Check your usage before starting again.",
          );
        }
      }
    };
    try {
      if (navigator.locks) {
        await navigator.locks.request(
          "historical-explorer:rome:story-queue:v1",
          { ifAvailable: true },
          async (lock) => {
            if (!lock) {
              setError("Automatic generation is running in another browser tab.");
              return;
            }
            await process();
          },
        );
      } else {
        await process();
      }
    } catch (cause) {
      if (mounted.current) setError(getActionError(cause).title);
    } finally {
      running.current = false;
      if (mounted.current) {
        setIsRunning(false);
        setIsPausing(false);
        setIsPaused(current.remaining.length > 0);
        onRunningChange([]);
      }
    }
  };

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
    generate,
    pause: () => {
      if (!running.current) return;
      pauseRequested.current = true;
      setIsPausing(true);
    },
  };
};
