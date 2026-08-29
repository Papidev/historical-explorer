import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { GenerationCheckpoint } from "@/server/storyWorkflow/types";
import { sanitizePoiIdForFile } from "@/server/wikiPipeline/normalize";

export type GenerationStep = "transformed" | "wiki" | "ai" | "storyContent" | "image";

export type GenerationMetadata = Record<
  string,
  Partial<Record<GenerationStep, GenerationCheckpoint>>
>;

const filePath = () =>
  path.join(process.cwd(), "data", "rome", "generated", "generation-metadata.json");

export const readGenerationMetadata = () =>
  existsSync(filePath())
    ? (JSON.parse(readFileSync(filePath(), "utf-8")) as GenerationMetadata)
    : ({} as GenerationMetadata);

const writeGenerationMetadata = (metadata: GenerationMetadata) => {
  const outputFilePath = filePath();
  const temporaryFilePath = `${outputFilePath}.tmp`;
  mkdirSync(path.dirname(outputFilePath), { recursive: true });
  writeFileSync(temporaryFilePath, `${JSON.stringify(metadata, null, 2)}\n`, "utf-8");
  renameSync(temporaryFilePath, outputFilePath);
};

export const replaceGenerationCheckpoint = (
  poiId: string,
  step: GenerationStep,
  checkpoint: GenerationCheckpoint,
) => {
  const key = sanitizePoiIdForFile(poiId);
  const metadata = readGenerationMetadata();
  writeGenerationMetadata({
    ...metadata,
    [key]: { ...metadata[key], [step]: checkpoint },
  });
};

export const deleteGenerationCheckpoints = (poiId: string, steps: GenerationStep[]) => {
  const key = sanitizePoiIdForFile(poiId);
  const metadata = readGenerationMetadata();
  const poiMetadata = metadata[key];
  if (!poiMetadata) {
    return;
  }

  for (const step of steps) {
    delete poiMetadata[step];
  }
  if (Object.keys(poiMetadata).length === 0) {
    delete metadata[key];
  } else {
    metadata[key] = poiMetadata;
  }
  writeGenerationMetadata(metadata);
};
