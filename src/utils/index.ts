import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { serialize } from "next-mdx-remote/serialize";
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

const readPoiDialogContent = async (city: string, id: string) => {
  const filePath = path.join(process.cwd(), "content", "pois", toCitySlug(city), `${id}.mdx`);
  if (!existsSync(filePath)) {
    return undefined;
  }

  const raw = readFileSync(filePath, "utf-8").trim();
  if (!raw) {
    return undefined;
  }

  try {
    return await serialize(raw);
  } catch {
    return undefined;
  }
};

const asPoi = async (
  feature: GeoJsonFeature,
  index: number,
  fallbackCity: string,
): Promise<Poi | null> => {
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
        : pickString(properties, "id", "@id") ?? fallbackId;

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
  const city =
    pickString(properties, "addr:city", "is_in:city") ?? fallbackCity;

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
    dialogContentMdx: await readPoiDialogContent(fallbackCity, rawId),
    funFacts,
  };
};

const toCitySlug = (city: string) =>
  city
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const buildGeoJsonFilePath = (city: string) => {
  const slug = toCitySlug(city);
  return path.join(process.cwd(), "public", "data", `${slug}-pois.geojson`);
};

const loadGeoJsonForCity = (city: string): GeoJson => {
  const filePath = buildGeoJsonFilePath(city);
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
  const pois = await Promise.all(
    features.map((feature, index) => asPoi(feature, index, city)),
  );

  return pois.filter((poi): poi is Poi => Boolean(poi));
};
