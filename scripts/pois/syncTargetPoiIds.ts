import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type GeoJsonFeature = {
  id?: string | number;
  properties?: Record<string, unknown>;
};

type GeoJson = {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
};

const DEFAULT_TARGET_PATH = path.join(process.cwd(), "public", "data", "rome-pois.geojson");

const parseArg = (name: "--target"): string | undefined => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const parseGeoJson = (filePath: string): GeoJson => {
  const raw = readFileSync(filePath, "utf8");
  return JSON.parse(raw) as GeoJson;
};

const writeGeoJson = (filePath: string, geoJson: GeoJson) => {
  writeFileSync(filePath, `${JSON.stringify(geoJson, null, 2)}\n`, "utf8");
};

const getString = (properties: Record<string, unknown>, key: string) => {
  const value = properties[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
};

const main = () => {
  const targetPath = parseArg("--target") ?? DEFAULT_TARGET_PATH;
  const targetGeoJson = parseGeoJson(targetPath);

  if (!Array.isArray(targetGeoJson.features)) {
    throw new Error("Invalid GeoJSON structure.");
  }

  let updatedCount = 0;
  for (const feature of targetGeoJson.features) {
    const properties = feature.properties ?? {};
    const wikidata = getString(properties, "wikidata");
    if (!wikidata) {
      continue;
    }

    feature.id = wikidata;
    delete properties.wikidata;
    updatedCount += 1;
  }

  if (updatedCount === 0) {
    console.log("No target POI entries had wikidata to promote into id.");
    return;
  }

  writeGeoJson(targetPath, targetGeoJson);
  console.log(`Promoted wikidata to id and removed wikidata property for ${updatedCount} POI(s).`);
  console.log(`Updated: ${targetPath}`);
};

main();
