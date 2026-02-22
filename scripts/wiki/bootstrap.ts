import path from "node:path";
import { fetchWikiSnapshot } from "./fetchWiki";
import {
  buildOutputFilePath,
  findPoiInGeoJson,
  getDefaultInputPath,
  getDefaultOutputDir,
  outputExists,
  writeSnapshotFile,
} from "./io";
import { resolvePageForPoi } from "./resolve";
import type { WikiSnapshotFile } from "./types";

type CliOptions = {
  city?: string;
  poiId?: string;
  force: boolean;
  inputPath?: string;
  outputDir?: string;
};

const parseArgs = (argv: string[]): CliOptions => {
  const options: CliOptions = { force: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--city") {
      options.city = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--poi-id") {
      options.poiId = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--input") {
      options.inputPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--output-dir") {
      options.outputDir = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--force") {
      options.force = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printHelpAndExit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
};

const printHelpAndExit = (code: number): never => {
  console.log(
    "Usage: pnpm wiki:bootstrap --city <citySlug> --poi-id <id> [--force] [--input <path>] [--output-dir <path>]",
  );
  process.exit(code);
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  if (!options.city || !options.poiId) {
    printHelpAndExit(1);
  }

  const city = options.city as string;
  const poiId = options.poiId as string;
  const inputPath = options.inputPath ? path.resolve(options.inputPath) : getDefaultInputPath(city);
  const outputDir = options.outputDir ? path.resolve(options.outputDir) : getDefaultOutputDir();

  const poi = findPoiInGeoJson(inputPath, poiId, city);
  const outputFilePath = buildOutputFilePath(outputDir, poi.id);

  if (outputExists(outputFilePath) && !options.force) {
    console.log(`Skip: ${outputFilePath} already exists. Use --force to overwrite.`);
    return;
  }

  const resolved = await resolvePageForPoi(poi);
  const snapshot = await fetchWikiSnapshot(resolved.selected.title);

  const payload: WikiSnapshotFile = {
    id: poi.id,
    content: snapshot.fullText,
  };

  writeSnapshotFile(outputFilePath, payload);
  console.log(`Wrote snapshot: ${outputFilePath}`);
};

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`wiki:bootstrap failed: ${message}`);
  process.exit(1);
});
