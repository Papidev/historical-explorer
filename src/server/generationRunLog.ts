import { randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { toCitySlug } from "@/server/wikiPipeline/normalize";
import { StoryWorkflowError } from "@/server/storyWorkflow/types";

const retainedDays = 7;

type GenerationRun = {
  city: string;
  operation: string;
  geoPlaceId?: string;
  poiId?: string;
  ai?: { mode: string; model: string };
};

type GenerationOutcome = {
  poiId?: string;
  status?: "success" | "partial";
  failedSteps?: string[];
  relatedPeopleFailureCount?: number;
  errors?: Array<{ stage: string; message: string; name?: string }>;
};

export type GenerationLogEntry = GenerationRun &
  GenerationOutcome & {
    runId: string;
    at: string;
    event: "started" | "completed" | "failed";
    durationMs?: number;
    errorCode?: string;
    errorStage?: string;
    errorMessage?: string;
  };

export const sanitizeErrorMessage = (message: string) =>
  message
    .replace(/([?&](?:key|api_key|token)=)[^&\s]+/gi, "$1[REDACTED]")
    .replace(/(Bearer\s+)[^\s]+/gi, "$1[REDACTED]")
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[REDACTED]")
    .slice(0, 2_000);

export const writeGenerationLogEntry = (rootPath: string, entry: GenerationLogEntry) => {
  const day = entry.at.slice(0, 10);
  const slot = Math.floor(Date.parse(`${day}T00:00:00.000Z`) / 86_400_000) % retainedDays;
  const filePath = path.join(
    rootPath,
    "data",
    toCitySlug(entry.city),
    "generated",
    "generation-logs",
    `day-${slot}.jsonl`,
  );
  mkdirSync(path.dirname(filePath), { recursive: true });
  const line = `${JSON.stringify(entry)}\n`;
  const previousDay = existsSync(filePath)
    ? readFileSync(filePath, "utf-8").split("\n", 1)[0]
    : undefined;

  if (previousDay && JSON.parse(previousDay).at?.slice(0, 10) === day) {
    appendFileSync(filePath, line, "utf-8");
  } else {
    writeFileSync(filePath, line, "utf-8");
  }
};

export const readGenerationRuns = (rootPath: string, city: string) => {
  const directory = path.join(rootPath, "data", toCitySlug(city), "generated", "generation-logs");
  const runs = new Map<string, GenerationLogEntry>();

  for (let slot = 0; slot < retainedDays; slot += 1) {
    const filePath = path.join(directory, `day-${slot}.jsonl`);
    if (!existsSync(filePath)) continue;

    for (const line of readFileSync(filePath, "utf-8").split("\n")) {
      if (!line) continue;
      try {
        const entry = JSON.parse(line) as GenerationLogEntry;
        if (!entry.runId || !entry.at || !entry.operation) continue;
        const previous = runs.get(entry.runId);
        if (!previous || entry.at >= previous.at) {
          runs.set(entry.runId, entry);
        }
      } catch {
        // A partial final line should not hide the other runs from the Curator.
      }
    }
  }

  return Array.from(runs.values()).sort((left, right) => right.at.localeCompare(left.at));
};

export const withGenerationRun = async <T>(
  input: GenerationRun,
  run: () => Promise<T>,
  summarize: (result: T) => GenerationOutcome = () => ({}),
): Promise<T> => {
  const runId = randomUUID();
  const startedAt = Date.now();
  const write = (entry: Omit<GenerationLogEntry, keyof GenerationRun | "runId" | "at">) => {
    try {
      writeGenerationLogEntry(process.cwd(), {
        ...input,
        ...entry,
        errorMessage: entry.errorMessage ? sanitizeErrorMessage(entry.errorMessage) : undefined,
        errors: entry.errors?.map((error) => ({
          ...error,
          message: sanitizeErrorMessage(error.message),
        })),
        runId,
        at: new Date().toISOString(),
      });
    } catch (error) {
      console.warn(`[generation] Could not write run log ${runId}.`, error);
    }
  };

  write({ event: "started" });
  try {
    const result = await run();
    write({
      event: "completed",
      durationMs: Date.now() - startedAt,
      status: "success",
      ...summarize(result),
    });
    return result;
  } catch (error) {
    write({
      event: "failed",
      durationMs: Date.now() - startedAt,
      errorCode: error instanceof StoryWorkflowError ? error.code : "unexpected-error",
      errorStage: error instanceof StoryWorkflowError ? error.stage : undefined,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    console.error(`[generation] ${input.operation} failed (run ${runId}).`, error);
    throw error;
  }
};
