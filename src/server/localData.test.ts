import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { getLocalDataDirectory } from "./localData";
import { readGenerationMetadata, replaceGenerationCheckpoint } from "./generationMetadata";
import { readGenerationRuns, writeGenerationLogEntry } from "./generationRunLog";
import { createPoiCategoriesForCity } from "./poiCategories";
import { createPoiTypeMappings } from "./poiTypeMappings";
import { getDefaultInputPath, getDefaultOutputDir } from "./wikiPipeline/io";

const originalWorkingDirectory = process.cwd();
const originalDirectory = process.env.HISTORICAL_EXPLORER_LOCAL_DATA_DIR;
let directory: string;

beforeEach(() => {
  directory = realpathSync(mkdtempSync(path.join(tmpdir(), "local-data-")));
  for (const checkout of ["main", "worktree"]) {
    mkdirSync(path.join(directory, checkout, "data", "rome", "pois"), { recursive: true });
  }
  process.env.HISTORICAL_EXPLORER_LOCAL_DATA_DIR = path.join(directory, "shared");
  process.chdir(path.join(directory, "main"));
});

afterEach(() => {
  process.chdir(originalWorkingDirectory);
  if (originalDirectory === undefined) delete process.env.HISTORICAL_EXPLORER_LOCAL_DATA_DIR;
  else process.env.HISTORICAL_EXPLORER_LOCAL_DATA_DIR = originalDirectory;
  rmSync(directory, { recursive: true, force: true });
});

it("uses the same external default regardless of the checkout", () => {
  delete process.env.HISTORICAL_EXPLORER_LOCAL_DATA_DIR;
  expect(getLocalDataDirectory()).toBe(
    path.join(homedir(), ".local", "share", "historical-explorer"),
  );
  process.chdir(path.join(directory, "worktree"));
  expect(getLocalDataDirectory()).toBe(
    path.join(homedir(), ".local", "share", "historical-explorer"),
  );
});

it("shares Sources, Types, checkpoints and logs without links while keeping POIs and categories in each branch", () => {
  mkdirSync(getDefaultOutputDir("rome"), { recursive: true });
  writeFileSync(path.join(getDefaultOutputDir("rome"), "tower.txt"), "Shared Wikipedia Source");
  mkdirSync(path.join(getLocalDataDirectory(), "rome", "generated", "wikidata"));
  writeFileSync(
    path.join(getLocalDataDirectory(), "rome", "generated", "wikidata", "tower.json"),
    JSON.stringify({ types: [{ id: "Q1", label: "Tower" }] }),
  );
  replaceGenerationCheckpoint("rome", "tower", "wiki", {
    durationMs: 1,
    completedAt: "2026-10-14T00:00:00.000Z",
  });
  writeGenerationLogEntry({
    city: "rome",
    operation: "draftStory.generate",
    runId: "shared-run",
    at: "2026-10-14T00:00:00.000Z",
    event: "completed",
  });

  for (const checkout of ["main", "worktree"]) {
    process.chdir(path.join(directory, checkout));
    writeFileSync(
      getDefaultInputPath("rome"),
      JSON.stringify({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            id: "tower",
            wikidataId: "Q1",
            properties: { name: checkout },
            geometry: { type: "Point", coordinates: [12, 41] },
          },
        ],
      }),
    );
    writeFileSync(
      path.join("data", "poi-type-category-map.json"),
      JSON.stringify({ version: 1, mappings: { Q1: ["Tower"] } }),
    );
    writeFileSync(
      path.join("data", "poi-category-catalog.json"),
      JSON.stringify({ version: 1, categories: [{ id: "Tower", name: "Tower" }] }),
    );

    expect(readFileSync(path.join(getDefaultOutputDir("rome"), "tower.txt"), "utf8")).toBe(
      "Shared Wikipedia Source",
    );
    expect(readGenerationMetadata("rome").tower.wiki?.durationMs).toBe(1);
    expect(readGenerationRuns("rome")[0].runId).toBe("shared-run");
    expect(createPoiTypeMappings().getCatalog().types[0].pois[0].name).toBe(checkout);
    createPoiCategoriesForCity("rome").rebuild();
    expect(createPoiCategoriesForCity("rome").getAll().tower).toEqual(["Tower"]);
    expect(existsSync(path.join("data", "rome", "generated"))).toBe(false);
    expect(existsSync(path.join("data", "generated"))).toBe(false);
    expect(getDefaultInputPath("rome")).toBe(
      path.join(directory, checkout, "data", "rome", "pois", "pois.geojson"),
    );
  }
});
