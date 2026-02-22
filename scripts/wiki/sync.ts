import { spawnSync } from "node:child_process";
import path from "node:path";

type CliOptions = {
  city?: string;
  poiId?: string;
  force: boolean;
  geoJsonPath?: string;
  wikiDir?: string;
  mdxOutputDir?: string;
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
    if (arg === "--geojson") {
      options.geoJsonPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--wiki-dir") {
      options.wikiDir = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--output-dir") {
      options.mdxOutputDir = argv[i + 1];
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
    "Usage: pnpm wiki:sync --city <citySlug> --poi-id <id> [--force] [--geojson <path>] [--wiki-dir <path>] [--output-dir <path>]",
  );
  process.exit(code);
};

const runStep = (label: string, args: string[]) => {
  const result = spawnSync("pnpm", args, {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? "unknown"}`);
  }
};

const main = () => {
  const options = parseArgs(process.argv.slice(2));
  if (!options.city || !options.poiId) {
    printHelpAndExit(1);
  }

  const city = options.city as string;
  const poiId = options.poiId as string;
  const geoJsonPath = options.geoJsonPath ? path.resolve(options.geoJsonPath) : undefined;
  const wikiDir = options.wikiDir ? path.resolve(options.wikiDir) : undefined;
  const mdxOutputDir = options.mdxOutputDir ? path.resolve(options.mdxOutputDir) : undefined;

  const bootstrapArgs = ["wiki:bootstrap", "--city", city, "--poi-id", poiId];
  if (options.force) {
    bootstrapArgs.push("--force");
  }
  if (geoJsonPath) {
    bootstrapArgs.push("--input", geoJsonPath);
  }
  if (wikiDir) {
    bootstrapArgs.push("--output-dir", wikiDir);
  }

  const toMdxArgs = ["wiki:to-mdx", "--city", city, "--poi-id", poiId];
  if (options.force) {
    toMdxArgs.push("--force");
  }
  if (geoJsonPath) {
    toMdxArgs.push("--geojson", geoJsonPath);
  }
  if (wikiDir) {
    toMdxArgs.push("--input-dir", wikiDir);
  }
  if (mdxOutputDir) {
    toMdxArgs.push("--output-dir", mdxOutputDir);
  }

  runStep("wiki:bootstrap", bootstrapArgs);
  runStep("wiki:to-mdx", toMdxArgs);
};

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`wiki:sync failed: ${message}`);
  process.exit(1);
}
