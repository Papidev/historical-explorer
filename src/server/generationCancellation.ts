import { AsyncLocalStorage } from "node:async_hooks";
import { readAiProgress } from "./aiProgress";

const generation = new AsyncLocalStorage<{ runId: string; controller: AbortController }>();

export const throwIfGenerationCancelled = () => {
  const current = generation.getStore();
  if (!current) return;
  if (readAiProgress(current.runId)?.stopRequested && !current.controller.signal.aborted)
    current.controller.abort(new DOMException("Generation stopped by user.", "AbortError"));
  current.controller.signal.throwIfAborted();
};

export const withGenerationCancellation = async <T>(
  runId: string | undefined,
  work: () => Promise<T>,
) => {
  if (!runId) return work();
  const controller = new AbortController();
  return generation.run({ runId, controller }, async () => {
    const timer = setInterval(() => {
      try {
        if (readAiProgress(runId)?.stopRequested)
          controller.abort(new DOMException("Generation stopped by user.", "AbortError"));
      } catch (error) {
        controller.abort(error);
      }
    }, 250);
    try {
      throwIfGenerationCancelled();
      const result = await work();
      throwIfGenerationCancelled();
      return result;
    } finally {
      clearInterval(timer);
    }
  });
};

export const fetchWithGenerationCancellation: typeof fetch = (input, init) => {
  throwIfGenerationCancelled();
  const signal = generation.getStore()?.controller.signal;
  if (!signal) return fetch(input, init);
  const existingSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
  return fetch(input, {
    ...init,
    signal: existingSignal ? AbortSignal.any([signal, existingSignal]) : signal,
  });
};
