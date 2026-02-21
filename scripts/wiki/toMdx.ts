import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { resolveContentSlugForPoi } from "./contentSlugResolver";
import { toCitySlug } from "./normalize";
import { wikiTextToMdx } from "./wikiToMdx";

type CliOptions = {
  city?: string;
  poiId?: string;
  force: boolean;
  inputDir?: string;
  geoJsonPath?: string;
  outputDir?: string;
};

type WikiJsonPayload = {
  id: string;
  content: string;
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
    if (arg === "--input-dir") {
      options.inputDir = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--geojson") {
      options.geoJsonPath = argv[i + 1];
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
    "Usage: pnpm wiki:to-mdx --city <citySlug> --poi-id <id> [--force] [--input-dir <path>] [--geojson <path>] [--output-dir <path>]",
  );
  process.exit(code);
};

const buildDefaultGeoJsonPath = (city: string) =>
  path.join(process.cwd(), "public", "data", `${toCitySlug(city)}-pois.geojson`);

const buildDefaultInputDir = () => path.join(process.cwd(), "data", "wiki");

const buildDefaultOutputDir = (city: string) =>
  path.join(process.cwd(), "content", "pois", toCitySlug(city));

const readWikiJson = (filePath: string): WikiJsonPayload => {
  if (!existsSync(filePath)) {
    throw new Error(`Wiki JSON not found: ${filePath}`);
  }

  const raw = readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw) as Partial<WikiJsonPayload>;

  if (typeof parsed.id !== "string" || parsed.id.trim().length === 0) {
    throw new Error(`Invalid wiki JSON: missing id in ${filePath}`);
  }

  if (typeof parsed.content !== "string" || parsed.content.trim().length === 0) {
    throw new Error(`Invalid wiki JSON: missing content in ${filePath}`);
  }

  return {
    id: parsed.id,
    content: parsed.content,
  };
};

const main = () => {
  const options = parseArgs(process.argv.slice(2));
  if (!options.city || !options.poiId) {
    printHelpAndExit(1);
  }

  const city = options.city as string;
  const poiId = options.poiId as string;
  const inputDir = options.inputDir ? path.resolve(options.inputDir) : buildDefaultInputDir();
  const geoJsonPath = options.geoJsonPath ? path.resolve(options.geoJsonPath) : buildDefaultGeoJsonPath(city);
  const outputDir = options.outputDir ? path.resolve(options.outputDir) : buildDefaultOutputDir(city);

  const wikiJsonPath = path.join(inputDir, `${poiId}.json`);
  const wiki = readWikiJson(wikiJsonPath);
  if (wiki.id !== poiId) {
    throw new Error(`POI id mismatch: expected ${poiId} but found ${wiki.id} in ${wikiJsonPath}`);
  }

  const contentSlug = resolveContentSlugForPoi(geoJsonPath, poiId);
  const outputPath = path.join(outputDir, `${contentSlug}.mdx`);

  if (existsSync(outputPath) && !options.force) {
    console.log(`Skip: ${outputPath} already exists. Use --force to overwrite.`);
    return;
  }

  mkdirSync(outputDir, { recursive: true });
  const mdx = wikiTextToMdx(wiki.content);
  writeFileSync(outputPath, mdx, "utf-8");
  console.log(`Wrote MDX: ${outputPath}`);
};

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`wiki:to-mdx failed: ${message}`);
  process.exit(1);
}
