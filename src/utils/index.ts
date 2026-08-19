import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { readCurrentDraftStoryArtifact } from "@/server/storyWorkflow/draftStoryArtifacts";
import type { Poi } from "@/types/Poi";

type GeoJson = {
  features?: GeoJsonFeature[];
};

type GeoJsonFeature = {
  id?: string | number;
  wikidataId?: string;
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

const toCitySlug = (city: string) =>
  city
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const getPoiDialogContent = async (city: string, poiId?: string) => {
  if (!poiId) {
    return undefined;
  }

  return readCurrentDraftStoryArtifact(poiId)?.content;
};

const asPoi = (feature: GeoJsonFeature, index: number, fallbackCity: string): Poi | null => {
  if (feature.geometry?.type !== "Point") {
    return null;
  }

  const coordinates = feature.geometry.coordinates;
  if (!coordinates || coordinates.length < 2) {
    return null;
  }

  const [rawLng, rawLat] = coordinates;

  const lng = rawLng;
  const lat = rawLat;

  const properties = feature.properties ?? {};
  const fallbackId = `poi-${index}`;
  const rawId =
    typeof feature.wikidataId === "string"
      ? feature.wikidataId
      : typeof feature.id === "string"
        ? feature.id
        : typeof feature.id === "number"
          ? `${feature.id}`
          : (pickString(properties, "id", "@id") ?? fallbackId);

  const name = pickString(properties, "name", "name:en", "name:it", "int_name") ?? rawId;
  const contentSlug = pickString(properties, "content_slug", "content:slug");
  const historic = pickString(properties, "historic");
  const period =
    pickString(properties, "period", "start_date", "historic:period", "historic:civilization") ??
    historic;
  const description =
    pickString(properties, "short_description", "description") ??
    (historic ? `Historic feature: ${historic}` : undefined);
  const city = pickString(properties, "addr:city", "is_in:city") ?? fallbackCity;

  const funFacts = [
    rawId.replace(/^/, "Wikidata: "),
    pickString(properties, "wikipedia")?.replace(/^/, "Wikipedia: "),
    pickString(properties, "heritage")?.replace(/^/, "Heritage status: "),
    pickString(properties, "charge")?.replace(/^/, "Ticket: "),
  ].filter((value): value is string => Boolean(value));

  return {
    id: rawId,
    contentSlug,
    name,
    city,
    coordinates: { lat, lng },
    period,
    shortDescription: description,
    funFacts,
  };
};

const buildGeoJsonFilePath = (city: string) => {
  const slug = toCitySlug(city);
  return path.join(process.cwd(), "data", slug, "generated", "pois.geojson");
};

const loadGeoJsonForCity = (city: string): GeoJson => {
  const filePath = buildGeoJsonFilePath(city);
  if (!existsSync(filePath)) {
    return { features: [] };
  }

  const raw = readFileSync(filePath, "utf-8");

  try {
    return JSON.parse(raw) as GeoJson;
  } catch {
    // Accept manually edited GeoJSON with trailing commas.
    const withoutTrailingCommas = raw.replace(/,\s*([}\]])/g, "$1");
    return JSON.parse(withoutTrailingCommas) as GeoJson;
  }
};

export const createPoisForCity = async (city: string): Promise<Poi[]> => {
  const features = loadGeoJsonForCity(city).features ?? [];
  const pois = features.map((feature, index) => asPoi(feature, index, city));

  return pois.filter((poi): poi is Poi => Boolean(poi));
};
