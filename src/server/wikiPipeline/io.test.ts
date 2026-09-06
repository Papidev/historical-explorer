import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findPoiInGeoJson } from "./io";
import { transformRawPoiFeature } from "./transformRawPoiFeature";

const temporaryDirectories: string[] = [];

afterEach(() => {
  temporaryDirectories.splice(0).forEach((directory) =>
    rmSync(directory, { recursive: true, force: true }),
  );
});

describe("findPoiInGeoJson", () => {
  it("loads the top-level Wikidata id preserved by the POI transform", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "wiki-pipeline-"));
    temporaryDirectories.push(directory);
    const inputPath = path.join(directory, "pois.geojson");
    writeFileSync(
      inputPath,
      JSON.stringify({
        type: "FeatureCollection",
        features: [
          transformRawPoiFeature(
            {
              properties: {
                name: "Piazza Navona",
                wikidata: "Q463400",
                wikipedia: "it:Piazza Navona",
              },
              geometry: {
                type: "Point",
                coordinates: [12.4730991, 41.8989256],
              },
            },
            { poiId: "piazza-navona", wikidataId: "Q463400" },
          ),
        ],
      }),
    );

    expect(findPoiInGeoJson(inputPath, "piazza-navona", "rome").sourceHints).toEqual({
      wikipedia: "it:Piazza Navona",
      wikidata: "Q463400",
    });
  });
});
