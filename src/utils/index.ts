import { readFileSync } from "node:fs";
import path from "node:path";
import type { Poi } from "@/types/Poi";

type GeoJson = {
  features?: GeoJsonFeature[];
};

type GeoJsonFeature = {
  id?: string | number;
  properties?: Record<string, unknown>;
  geometry?: {
    type?: string;
    coordinates?: number[];
  };
};

const pickString = (properties: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) {
    const value = properties[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }

  return undefined;
};

const asPoi = (feature: GeoJsonFeature, index: number): Poi | null => {
  if (feature.geometry?.type !== "Point") {
    return null;
  }

  const [lng, lat] = feature.geometry.coordinates ?? [];
  if (typeof lat !== "number" || typeof lng !== "number") {
    return null;
  }

  const properties = feature.properties ?? {};
  const fallbackId = `poi-${index}`;
  const rawId =
    typeof feature.id === "string"
      ? feature.id
      : typeof feature.id === "number"
        ? `${feature.id}`
        : pickString(properties, "@id") ?? fallbackId;

  const name =
    pickString(properties, "name", "name:en", "name:it", "int_name") ?? rawId;
  const historic = pickString(properties, "historic");
  const period =
    pickString(
      properties,
      "period",
      "start_date",
      "historic:period",
      "historic:civilization",
    ) ?? historic ?? "Historic period unavailable";
  const description =
    pickString(properties, "short_description", "description") ??
    (historic ? `Historic feature: ${historic}` : undefined) ??
    "Historic place sourced from OpenStreetMap.";
  const city = pickString(properties, "addr:city", "is_in:city") ?? "Rome";

  const funFacts = [
    pickString(properties, "wikidata")?.replace(/^/, "Wikidata: "),
    pickString(properties, "wikipedia")?.replace(/^/, "Wikipedia: "),
    pickString(properties, "heritage")?.replace(/^/, "Heritage status: "),
    pickString(properties, "charge")?.replace(/^/, "Ticket: "),
  ].filter((value): value is string => Boolean(value));

  return {
    id: rawId,
    name,
    city,
    coordinates: { lat, lng },
    period,
    shortDescription: description,
    funFacts,
  };
};

const DEFAULT_GEOJSON_FILE = "rome.geojson";

const loadGeoJson = (fileName: string = DEFAULT_GEOJSON_FILE): GeoJson => {
  const filePath = path.join(process.cwd(), "public", fileName);
  const raw = readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as GeoJson;
};

export const createPoisFromGeoJson = (
  fileName: string = DEFAULT_GEOJSON_FILE,
): Poi[] => {
  const features = loadGeoJson(fileName).features ?? [];

  return features
    .map(asPoi)
    .filter((poi): poi is Poi => Boolean(poi));
};

export const pois = createPoisFromGeoJson();
