import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { writeGenerationLogEntry } from "./generationRunLog";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

it("keeps seven daily log files and overwrites the oldest slot on day eight", () => {
  const root = mkdtempSync(path.join(tmpdir(), "generation-logs-"));
  roots.push(root);
  const directory = path.join(root, "data", "rome", "generated", "generation-logs");

  for (let day = 1; day <= 8; day += 1) {
    writeGenerationLogEntry(root, {
      city: "rome",
      operation: "draftStory.generate",
      runId: `run-${day}`,
      at: `2026-10-${String(day).padStart(2, "0")}T12:00:00.000Z`,
      event: "failed",
      errorCode: "sources-unavailable",
    });
  }

  expect(readdirSync(directory)).toHaveLength(7);
  const lines = readdirSync(directory).flatMap((file) =>
    readFileSync(path.join(directory, file), "utf-8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as { runId: string }),
  );
  expect(lines.map(({ runId }) => runId).sort()).toEqual(
    Array.from({ length: 7 }, (_, index) => `run-${index + 2}`).sort(),
  );
});

it("appends events from the same day without replacing earlier runs", () => {
  const root = mkdtempSync(path.join(tmpdir(), "generation-logs-"));
  roots.push(root);

  for (const runId of ["first", "second"]) {
    writeGenerationLogEntry(root, {
      city: "rome",
      operation: "storyContent.generate",
      runId,
      at: "2026-10-01T12:00:00.000Z",
      event: "completed",
    });
  }

  const directory = path.join(root, "data", "rome", "generated", "generation-logs");
  const [file = ""] = readdirSync(directory);
  expect(readFileSync(path.join(directory, file), "utf-8").trim().split("\n")).toHaveLength(2);
});
