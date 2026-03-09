import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type GeoJsonFeature = {
  id?: string | number;
  properties?: Record<string, unknown>;
  geometry?: unknown;
};

type GeoJson = {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
};

type DuplicateMode = "skip" | "error" | "replace";

const DEFAULT_RAW_PATH = path.join(process.cwd(), "public", "data", "raw", "rome-pois-raw.geojson");
const DEFAULT_TARGET_PATH = path.join(process.cwd(), "public", "data", "rome-pois.geojson");

const normalizeText = (value?: string) =>
  (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const slugify = (value: string) =>
  normalizeText(value)
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "");

const parseArg = (name: "--id" | "--raw" | "--target" | "--on-duplicate"): string | undefined => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const parseGeoJson = (filePath: string): GeoJson => {
  const raw = readFileSync(filePath, "utf8");
  return JSON.parse(raw) as GeoJson;
};

const getString = (properties: Record<string, unknown>, key: string) => {
  const value = properties[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
};

const toFeatureId = (feature: GeoJsonFeature) => {
  if (typeof feature.id === "string" && feature.id.trim().length > 0) {
    return feature.id.trim();
  }

  if (typeof feature.id === "number") {
    return `${feature.id}`;
  }

  return getString(feature.properties ?? {}, "@id");
};

const setFeatureId = (feature: GeoJsonFeature, id: string) => {
  feature.id = id;
};

const isWikidataId = (value?: string) => Boolean(value && /^Q\d+$/i.test(value));

const findFeatureById = (rawGeoJson: GeoJson, id: string) => {
  const match = rawGeoJson.features.find((feature) => {
    const featureId = toFeatureId(feature);
    return featureId === id;
  });

  if (match) {
    return match;
  }

  const sampleIds = rawGeoJson.features
    .map((feature) => toFeatureId(feature))
    .filter((value): value is string => Boolean(value))
    .slice(0, 10)
    .join(", ");

  throw new Error(
    `POI with id "${id}" was not found in raw data. Match by feature.id or properties.@id. Sample ids: ${sampleIds}`,
  );
};

const normalizeFeature = (source: GeoJsonFeature, allowedPropertyKeys: string[]) => {
  const sourceProperties = source.properties ?? {};
  const properties: Record<string, unknown> = {};

  for (const key of allowedPropertyKeys) {
    if (key === "wikidata") {
      continue;
    }

    const value = sourceProperties[key];
    if (value !== undefined && value !== null && value !== "") {
      properties[key] = value;
    }
  }

  if (!properties.content_slug) {
    const name =
      (typeof properties.name === "string" && properties.name) ||
      (typeof sourceProperties.name === "string" && sourceProperties.name);
    if (name) {
      properties.content_slug = slugify(name);
    }
  }

  const normalizedFeature: GeoJsonFeature = {
    ...source,
    properties,
  };
  const sourceWikidata = getString(sourceProperties, "wikidata");
  const sourceId = sourceWikidata ?? toFeatureId(source);
  if (sourceId) {
    setFeatureId(normalizedFeature, sourceId);
  }

  return normalizedFeature;
};

const findDuplicateIndex = (targetGeoJson: GeoJson, feature: GeoJsonFeature) => {
  const featureProps = feature.properties ?? {};
  const sourceName = getString(featureProps, "name");
  const sourceFeatureId = toFeatureId(feature);
  const sourceWikidata =
    getString(featureProps, "wikidata") ?? (isWikidataId(sourceFeatureId) ? sourceFeatureId : undefined);
  const sourceSlug = getString(featureProps, "content_slug");

  return targetGeoJson.features.findIndex((existing) => {
    const existingProps = existing.properties ?? {};
    const existingFeatureId = toFeatureId(existing);
    const existingWikidata =
      getString(existingProps, "wikidata") ??
      (isWikidataId(existingFeatureId) ? existingFeatureId : undefined);

    return (
      (sourceWikidata && existingWikidata === sourceWikidata) ||
      (sourceSlug && getString(existingProps, "content_slug") === sourceSlug) ||
      (sourceName && getString(existingProps, "name") === sourceName)
    );
  });
};

const parseDuplicateMode = (): DuplicateMode => {
  const rawMode = parseArg("--on-duplicate");
  if (!rawMode) {
    return "skip";
  }

  if (rawMode === "skip" || rawMode === "error" || rawMode === "replace") {
    return rawMode;
  }

  throw new Error(`Invalid --on-duplicate "${rawMode}". Supported values: skip, error, replace.`);
};

const writeGeoJson = (filePath: string, geoJson: GeoJson) => {
  writeFileSync(filePath, `${JSON.stringify(geoJson, null, 2)}\n`, "utf8");
};

const logFeature = (prefix: string, feature: GeoJsonFeature) => {
  const properties = feature.properties ?? {};
  const name = getString(properties, "name") ?? "(no-name)";
  const id = toFeatureId(feature) ?? "no-id";
  console.log(`${prefix}: ${name} (${id})`);
};

const main = () => {
  const id = parseArg("--id");
  if (!id) {
    throw new Error("Missing required --id <raw-poi-id>.");
  }

  const duplicateMode = parseDuplicateMode();
  const rawPath = parseArg("--raw") ?? DEFAULT_RAW_PATH;
  const targetPath = parseArg("--target") ?? DEFAULT_TARGET_PATH;

  const rawGeoJson = parseGeoJson(rawPath);
  const targetGeoJson = parseGeoJson(targetPath);

  if (!Array.isArray(rawGeoJson.features) || !Array.isArray(targetGeoJson.features)) {
    throw new Error("Invalid GeoJSON structure.");
  }

  const sourceFeature = findFeatureById(rawGeoJson, id);
  const allowedPropertyKeys = [
    ...new Set(targetGeoJson.features.flatMap((feature) => Object.keys(feature.properties ?? {}))),
  ];
  const normalized = normalizeFeature(sourceFeature, allowedPropertyKeys);
  const duplicateIndex = findDuplicateIndex(targetGeoJson, normalized);

  if (duplicateIndex >= 0) {
    const existing = targetGeoJson.features[duplicateIndex];
    const existingId = toFeatureId(existing);
    const normalizedId = toFeatureId(normalized);
    const shouldSyncExistingId = Boolean(normalizedId && existingId !== normalizedId);

    if (duplicateMode === "skip") {
      if (shouldSyncExistingId && normalizedId) {
        setFeatureId(existing, normalizedId);
        writeGeoJson(targetPath, targetGeoJson);
        logFeature("Synced existing POI id", normalized);
        console.log(`Updated: ${targetPath}`);
        return;
      }

      logFeature("Skipped existing POI", normalized);
      console.log(`Target unchanged: ${targetPath}`);
      return;
    }

    if (duplicateMode === "error") {
      if (shouldSyncExistingId && normalizedId) {
        throw new Error(
          `POI already exists in target data with mismatched id (target: ${existingId ?? "none"}, source: ${normalizedId}).`,
        );
      }
      throw new Error(`POI already exists in target data (duplicate index: ${duplicateIndex}).`);
    }

    targetGeoJson.features[duplicateIndex] = normalized;
    writeGeoJson(targetPath, targetGeoJson);
    logFeature("Updated POI", normalized);
    console.log(`Updated: ${targetPath}`);
    return;
  }

  targetGeoJson.features.push(normalized);
  writeGeoJson(targetPath, targetGeoJson);
  logFeature("Added POI", normalized);
  console.log(`Updated: ${targetPath}`);
};

main();
