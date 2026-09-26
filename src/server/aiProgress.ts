import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

export type AiProgress = {
  status: "running" | "succeeded" | "failed";
  startedAt: string;
  entries: Array<{ at: string; message: string }>;
};

const getProgressPath = (runId: string) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(runId)) {
    throw new Error("Invalid AI progress ID.");
  }
  return path.join(process.cwd(), "data", "rome", "generated", "ai-progress", `${runId}.json`);
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
  writeProgress(runId, { status: "running", startedAt: new Date().toISOString(), entries: [] });
};

export const appendAiProgress = (runId: string, message: string) => {
  const progress = readAiProgress(runId);
  if (!progress || progress.status !== "running") return;
  writeProgress(runId, {
    ...progress,
    entries: [...progress.entries, { at: new Date().toISOString(), message }],
  });
};

export const finishAiProgress = (runId: string, status: "succeeded" | "failed") => {
  const progress = readAiProgress(runId);
  if (progress) writeProgress(runId, { ...progress, status });
};
