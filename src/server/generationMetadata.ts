import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { GenerationCheckpoint } from "@/server/storyWorkflow/types";
import { sanitizePoiIdForFile, toCitySlug } from "@/server/wikiPipeline/normalize";

export type GenerationStep = "transformed" | "wiki" | "storyContent" | "relatedPeople" | "image";

export type GenerationMetadata = Record<
  string,
  Partial<Record<GenerationStep, GenerationCheckpoint>> & { sourceMissing?: boolean }
>;

const filePath = (city: string) =>
  path.join(process.cwd(), "data", toCitySlug(city), "generated", "generation-metadata.json");

export const readGenerationMetadata = (city: string) =>
  existsSync(filePath(city))
    ? (JSON.parse(readFileSync(filePath(city), "utf-8")) as GenerationMetadata)
    : ({} as GenerationMetadata);

const writeGenerationMetadata = (city: string, metadata: GenerationMetadata) => {
  const outputFilePath = filePath(city);
  const temporaryFilePath = `${outputFilePath}.tmp`;
  mkdirSync(path.dirname(outputFilePath), { recursive: true });
  writeFileSync(temporaryFilePath, `${JSON.stringify(metadata, null, 2)}\n`, "utf-8");
  renameSync(temporaryFilePath, outputFilePath);
};

export const replaceGenerationCheckpoint = (
  city: string,
  poiId: string,
  step: GenerationStep,
  checkpoint: GenerationCheckpoint,
) => {
  const key = sanitizePoiIdForFile(poiId);
  const metadata = readGenerationMetadata(city);
  const poiMetadata = { ...metadata[key] };
  if (step === "wiki") delete poiMetadata.sourceMissing;
  writeGenerationMetadata(city, {
    ...metadata,
    [key]: { ...poiMetadata, [step]: checkpoint },
  });
};

export const markSourceMissing = (city: string, poiId: string) => {
  const key = sanitizePoiIdForFile(poiId);
  const metadata = readGenerationMetadata(city);
  writeGenerationMetadata(city, {
    ...metadata,
    [key]: { ...metadata[key], sourceMissing: true },
  });
};

export const deleteGenerationCheckpoints = (
  city: string,
  poiId: string,
  steps: GenerationStep[],
) => {
  const key = sanitizePoiIdForFile(poiId);
  const metadata = readGenerationMetadata(city);
  const poiMetadata = metadata[key];
  if (!poiMetadata) {
    return;
  }

  for (const step of steps) {
    delete poiMetadata[step];
  }
  if (steps.includes("wiki")) delete poiMetadata.sourceMissing;
  if (Object.keys(poiMetadata).length === 0) {
    delete metadata[key];
  } else {
    metadata[key] = poiMetadata;
  }
  writeGenerationMetadata(city, metadata);
};
