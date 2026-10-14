import { getLocalDataDirectory } from "@/server/localData";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

export type AiProgress = {
  status: "running" | "succeeded" | "partial" | "failed" | "waiting" | "cancelled";
  startedAt: string;
  serverInstance?: string;
  storyContentStarted?: boolean;
  stopRequested?: boolean;
  error?: string;
  warning?: { title: string; description?: string; details?: string };
  failedSteps?: string[];
  entries: Array<{ at: string; message: string }>;
};

const server = globalThis as typeof globalThis & { historicalExplorerServerInstance?: string };
export const aiProgressServerInstance = (server.historicalExplorerServerInstance ??= randomUUID());

const getProgressPath = (runId: string) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(runId)) {
    throw new Error("Invalid AI progress ID.");
  }
  return path.join(getLocalDataDirectory(), "rome", "generated", "ai-progress", `${runId}.json`);
};

const writeProgress = (runId: string, progress: AiProgress) => {
  const filePath = getProgressPath(runId);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(`${filePath}.tmp`, `${JSON.stringify(progress)}\n`);
  renameSync(`${filePath}.tmp`, filePath);
};

export const readAiProgress = (runId: string): AiProgress | undefined => {
  const filePath = getProgressPath(runId);
  return existsSync(filePath)
    ? (JSON.parse(readFileSync(filePath, "utf-8")) as AiProgress)
    : undefined;
};

export const startAiProgress = (runId: string) => {
  writeProgress(runId, {
    status: "running",
    startedAt: new Date().toISOString(),
    entries: [],
    serverInstance: aiProgressServerInstance,
    ...(readAiProgress(runId)?.stopRequested ? { stopRequested: true } : {}),
  });
};

export const appendAiProgress = (runId: string, message: string) => {
  const progress = readAiProgress(runId);
  if (!progress || progress.status !== "running") return;
  writeProgress(runId, {
    ...progress,
    entries: [...progress.entries, { at: new Date().toISOString(), message }],
  });
};

export const markStoryContentStarted = (runId: string) => {
  const progress = readAiProgress(runId);
  if (progress) writeProgress(runId, { ...progress, storyContentStarted: true });
};

export const finishAiProgress = (
  runId: string,
  status: "succeeded" | "partial" | "failed" | "waiting" | "cancelled",
  failedSteps?: string[],
  outcome?: Pick<AiProgress, "error" | "warning">,
) => {
  const progress = readAiProgress(runId);
  if (progress) writeProgress(runId, { ...progress, status, failedSteps, ...outcome });
};

export const requestAiProgressStop = (runId: string) => {
  const progress = readAiProgress(runId);
  if (progress && progress.status !== "running") return false;
  writeProgress(runId, {
    ...(progress ?? {
      status: "cancelled",
      startedAt: new Date().toISOString(),
      entries: [],
      serverInstance: aiProgressServerInstance,
    }),
    stopRequested: true,
  });
  return true;
};
